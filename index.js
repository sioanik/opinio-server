const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000


// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())


// Verify Token Middleware
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token
    // console.log(token)
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.log(err)
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.user = decoded
        next()
    })
}







const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.NOMADNEST_USER}:${process.env.NOMADNEST_KEY}@cluster0.cczhmev.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        const db = client.db('nomadnestDB')
        const usersCollection = db.collection('users')
        const postsCollection = db.collection('posts')
        const commentsCollection = db.collection('comments')
        const annCollection = db.collection('announcements')
        const tagsCollection = db.collection('tags')
        const paymentsCollection = db.collection('payments')


        // verify admin
        const verifyAdmin = async (req, res, next) => {
            const email = req.user.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isAdmin = user?.role === 'Admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }


        // auth related api
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '180d',
            })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                })
                .send({ success: true })
        })

        // Logout
        app.get('/logout', async (req, res) => {
            try {
                res
                    .clearCookie('token', {
                        maxAge: 0,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                    })
                    .send({ success: true })
                console.log('Logout successful')
            } catch (err) {
                res.status(500).send(err)
            }
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if user doesnt exists: 
            // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });


        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'Admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })


        // announcements related apis 




        // save a user data in db
        // app.put('/user', async (req, res) => {
        //     const user = req.body

        //     const query = { email: user?.email }
        //     // check if user already exists in db
        //     const isExist = await usersCollection.findOne(query)
        //     if (isExist) {
        //         return res.send(isExist)

        //     }

        //     // save user for the first time
        //     const options = { upsert: true }
        //     const updateDoc = {
        //         $set: {
        //             ...user,
        //             timestamp: Date.now(),
        //         },
        //     }
        //     const result = await usersCollection.updateOne(query, updateDoc, options)
        //     // // welcome new user
        //     // sendEmail(user?.email, {
        //     //     subject: 'Welcome to NomadNest!',
        //     //     message: `Hope you will find you next destination`,
        //     // })
        //     res.send(result)
        // })


        // get all users data
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        })


        // get a user info by email
        app.get('/user/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const result = await usersCollection.findOne({ email })
            res.send(result)
        })


        // post related apis 
        app.post('/posts', verifyToken, async (req, res) => {
            const newPost = req.body
            // console.log(newBook)
            const result = await postsCollection.insertOne(newPost)
            res.send(result)
        })

        app.get('/posts/:email', verifyToken, async (req, res) => {
            const result = await postsCollection.find({ author_email: req.params.email }).toArray()
            res.send(result)
        })

        app.delete('/posts/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await postsCollection.deleteOne(query);
            res.send(result);
        });

        app.get('/post/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await postsCollection.findOne(query);
            // console.log(result);
            res.send(result);
        });







        app.get('/allpostsdefault', async (req, res) => {
            const result = await postsCollection.find().sort({ post_time: -1 }).toArray()
            res.send(result)
        })

        app.get('/allpostssorted', async (req, res) => {
            try {
                // Check if the collection has documents
                const posts = await postsCollection.find().toArray();
                // console.log('All posts:', posts);

                // Verify the field names in a sample document
                const samplePost = await postsCollection.findOne();
                // console.log('Sample post:', samplePost);

                // Check intermediate result after adding the voteDifference field
                const addFieldsStage = await postsCollection.aggregate([
                    {
                        $addFields: {
                            voteDifference: { $subtract: ["$upvote", "$downvote"] }
                        }
                    }
                ]).toArray();
                // console.log('After addFields stage:', addFieldsStage);

                // Perform the full aggregation
                const sortedPosts = await postsCollection.aggregate([
                    {
                        $addFields: {
                            voteDifference: { $subtract: ["$upvote", "$downvote"] }
                        }
                    },
                    {
                        $sort: {
                            voteDifference: -1
                        }
                    }
                ]).toArray();

                res.send(sortedPosts);
            } catch (err) {
                console.error('Error occurred:', err);
                res.status(500).send('Internal Server Error');
            }
        });



        // search related api 
        app.get('/tag-posts', async (req, res) => {
            const filter = req.query
            // console.log(filter);
            const query = {
                tag: { $regex: filter.search, $options: 'i' }
            }

            const options = {
                sort: { post_time: -1 }
            }

            const cursor = postsCollection.find(query, options)
            const result = await cursor.toArray()
            // console.log(result);
            res.send(result)
        })



        // // Get all posts data from db for pagination
        // app.get('/all-posts', async (req, res) => {
        //     const size = parseInt(req.query.size)
        //     const page = parseInt(req.query.page) - 1
        //     // const filter = req.query.filter
        //     const sort = req.query.sort
        //     const search = req.query.search
        //     console.log(size, page, sort, search)

        //     // const result = await postsCollection.find().sort({ post_time: -1 }).toArray()
        //     let query = {}
        //     if (search) query = {
        //         tag: { $regex: search, $options: 'i' }
        //         // let query = {
        //         //     tag: { $regex: search, $options: 'i' },
        //     }
        //     let options = {}
        //     // if (!sort) options = { sort: { deadline: sort === 'asc' ? 1 : -1 } }
        //     if (sort=='false') 
        //         options = { sort: { post_time: -1 } }
        //     if (sort == 'true') options = {
        //         $expr: { $subtract: ["$upvote", "$downvote"] }
        //     }
        //     const result = await postsCollection
        //         // .find(query, options)
        //         .find(query, options)
        //         .skip(page * size)
        //         .limit(size)
        //         .toArray()

        //     res.send(result)
        // })


        app.get('/all-posts', async (req, res) => {
            const size = parseInt(req.query.size);
            const page = parseInt(req.query.page) - 1;
            const sort = req.query.sort;
            const search = req.query.search;
            console.log(size, page, sort, search);
        
            let matchStage = {};
            if (search) {
                matchStage = {
                    tag: { $regex: search, $options: 'i' }
                };
            }
        
            let sortStage = {};
            if (sort === 'false') {
                sortStage = { post_time: -1 };
            } else if (sort === 'true') {
                sortStage = { $subtract: ["$upvote", "$downvote"] };
            }
        
            try {
                const pipeline = [
                    { $match: matchStage },
                    {
                        $addFields: {
                            voteDifference: { $subtract: ["$upvote", "$downvote"] }
                        }
                    },
                    { $sort: sort === 'true' ? { voteDifference: -1 } : { post_time: -1 } },
                    { $skip: page * size },
                    { $limit: size }
                ];
        
                const result = await postsCollection.aggregate(pipeline).toArray();
                
                res.send(result);
            } catch (error) {
                console.error('Error fetching posts:', error);
                res.status(500).send('An error occurred while fetching posts.');
            }
        });
        




        // Get all posts data count from db
        app.get('/posts-count', async (req, res) => {
            // const filter = req.query.filter
            const search = req.query.search
            let query = {}
            if (search) { query.tag = { $regex: search, $options: 'i' } }
            // if (filter) query.category = filter
            const count = await postsCollection.countDocuments(query)

            res.send({ count })
        })






        // post vote related api 

        app.put('/upvote/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await postsCollection.updateOne(query, { $inc: { upvote: +1 } })
            res.send(result);
        });

        app.put('/downvote/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await postsCollection.updateOne(query, { $inc: { downvote: +1 } })
            res.send(result);
        });








        //   comments related apis 
        app.post('/postComments', async (req, res) => {
            const newComment = req.body
            // console.log(newBook)
            const result = await commentsCollection.insertOne(newComment)
            res.send(result)
        })

        app.get('/comments/:id', async (req, res) => {
            const id = req.params.id;
            const query = { post_id: id }
            const result = await commentsCollection.find(query).toArray()
            res.send(result)
        })


        app.patch('/comments/:id', async (req, res) => {
            const feedback = req.body
            // console.log(feedback.feedback);
            // return
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    feedback: feedback.feedback
                }
            }
            const result = await commentsCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })


        app.get('/comments', async (req, res) => {
            const query = { feedback: { $exists: true, $ne: null, $ne: false } };
            const result = await commentsCollection.find(query).toArray()
            res.send(result)
        })



        //   announcements related apis 
        app.post('/announcements', verifyToken, async (req, res) => {
            const newPost = req.body
            // console.log(newBook)
            const result = await annCollection.insertOne(newPost)
            res.send(result)
        })


        // violation warning related apis 
        app.patch('/users/give-warning/:email', verifyToken, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            // console.log(email);
            // return
            const filter = { email: email };
            const updatedDoc = {
                $set: {
                    warning: 'Your account is at risk! You have violated our rules. Be careful commenting next time!'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })


        app.patch('/users/remove-warning/:email', verifyToken, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            // console.log(email);
            // return
            const filter = { email: email };
            const updatedDoc = {
                $set: {
                    warning: ''
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })





        // tags related api 
        app.get('/tags', async (req, res) => {
            const result = await tagsCollection.find().toArray()
            res.send(result)
        })


        // announcements related apis 
        app.get('/announcements', async (req, res) => {
            const result = await annCollection.find().toArray()
            res.send(result)
        })




        // payments related apis 
        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(amount, 'amount inside the intent')

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        });


        app.post('/payments', verifyToken, async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentsCollection.insertOne(payment);
            res.send(paymentResult)


        })

        app.patch('/users/make-gold/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            // console.log(email);
            // return
            const filter = { email: email };
            const updatedDoc = {
                $set: {
                    status: 'Gold'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc);
            console.log(result);
            res.send(result);
        })





        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})