const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;

// middleware
app.use(
    cors({
        origin: ["http://localhost:5173", "https://survey-haven.web.app", "https://survey-haven.firebaseapp.com"],
        credentials: true,
    }));
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hsfxbe1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const userCollection = client.db("SurveyDb").collection("users");
        const surveyCollection = client.db("SurveyDb").collection("surveys");

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '7day'
            });
            res.send({ token });
        })

        // middlwares
        const verifyToken = (req, res, next) => {
            console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' });
                }
                req.decoded = decoded;
                next();
            })
        }

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        // use verify surveyor after verifyToken
        const verifySurveyor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = await userCollection.findOne(query);
            const isSurveyor = user?.role === 'surveyor';
            if (!isSurveyor) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        // users related api
        app.post('/users', async (req, res) => {
            const user = req.body;

            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }

            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        app.get('/users', async (req, res) => {
            try {
                const { role } = req.query;
                const query = role ? { role } : {};
                const users = await userCollection.find(query).toArray();
                res.json(users);
            } catch (error) {
                console.error('Error fetching users:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.params.email) {
                return res.send(403).send({ message: 'forbidden access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.get('/users/surveyor/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.params.email) {
                return res.send(403).send({ message: 'unsuthorized access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let surveyor = false;
            if (user) {
                surveyor = user?.role === 'surveyor';
            }
            res.send({ surveyor });
        })

        app.patch('/users/surveyor/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'surveyor'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // surveys related api
        app.post('/surveys', verifyToken, async (req, res) => {
            const newSurvey = req.body;
            // console.log(newSurvey);
            const result = await surveyCollection.insertOne(newSurvey);
            res.send(result);
        })

        app.get('/surveys', async (req, res) => {
            const result = await surveyCollection.find().toArray();
            res.send(result);
        })

        app.get('/surveys/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await surveyCollection.findOne(query);
            res.send(result);
        })

        app.put('/surveys/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updatedSurvey = req.body;

            const survey = {
                $set: {
                    name: updatedSurvey.name,
                    email: updatedSurvey.email,
                    title: updatedSurvey.title,
                    description: updatedSurvey.description,
                    options: updatedSurvey.options,
                    category: updatedSurvey.category,
                    deadline: updatedSurvey.deadline,
                    yesCount: updatedSurvey.yesCount,
                    noCount: updatedSurvey.noCount,
                    totalVote: updatedSurvey.totalVote,
                    status: updatedSurvey.status,
                    date: updatedSurvey.date,

                }
            }

            const result = await surveyCollection.updateOne(filter, survey, options);
            res.send(result);
        });

        app.delete('/surveys/:id', verifyToken, verifySurveyor, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await surveyCollection.deleteOne(query);
            res.send(result);
        })

        app.get('/surveys', async (req, res) => {
            try {
                const topSurveys = await surveyCollection.find().sort({ topVote: -1 }).limit(6).toArray();
                res.status(200).json(topSurveys);
            } catch (error) {
                console.error('Error fetching top surveys:', error);
                res.status(500).json({ success: false, message: 'Internal Server Error' });
            }
        });

        // Fetch survey details
        app.get('/surveys/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const query = { _id: new ObjectId(id) }
                const survey = await surveyCollection.findOne(query);

                if (survey) {
                    // Ensure votes are initialized
                    if (!survey.votes) {
                        survey.votes = { yes: 0, no: 0 };
                    }
                    res.json(survey);
                } else {
                    res.status(404).send('Survey not found');
                }
            } catch (error) {
                console.error('Error fetching survey:', error);
                res.status(500).send('Internal Server Error');
            }
        });


        // Vote for survey
        app.post('/surveys/:id/vote', async (req, res) => {
            try {
                const { id } = req.params;
                const { vote } = req.body;
                const query = { _id: new ObjectId(id) };
                const survey = await surveyCollection.findOne(query);

                if (!survey) {
                    return res.status(404).send('Survey not found');
                }

                if (vote === 'yes') {
                    survey.yesCount += 1;
                } else if (vote === 'no') {
                    survey.noCount += 1;
                } else {
                    return res.status(400).send('Invalid vote value');
                }

                survey.totalVote += 1;
                await surveyCollection.updateOne(query, {
                    $set: {
                        yesCount: survey.yesCount,
                        noCount: survey.noCount,
                        totalVote: survey.totalVote
                    },
                });

                res.status(200).json({ success: true, updatedSurvey: survey });
            } catch (error) {
                console.error('Error recording vote:', error);
                res.status(500).send('Internal Server Error');
            }
        });




        // Report survey
        app.post('/surveys/:id/report', async (req, res) => {
            try {
                const { id } = req.params;
                // Add your report handling logic here
                res.status(200).json({ success: true });
            } catch (error) {
                console.error('Error reporting survey:', error);
                res.status(500).send('Internal Server Error');
            }
        });


        // Add comment (for pro-users only)
        app.post('/surveys/:id/comments', async (req, res) => {
            try {
                const { id } = req.params;
                const { comment } = req.body;
                const query = { _id: new ObjectId(id) }
                const survey = await surveyCollection.findOne(query);

                if (!survey) {
                    return res.status(404).send('Survey not found');
                }

                if (!survey.comments) {
                    survey.comments = [];
                }

                survey.comments.push(comment);
                await surveyCollection.updateOne(query, { $set: { comments: survey.comments } });

                res.status(200).json({ success: true, comment });
            } catch (error) {
                console.error('Error adding comment:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('server is running')
})

app.listen(port, () => {
    console.log(`SurveyHaven is sitting on port ${port}`);
})