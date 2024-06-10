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
    origin: ['http://localhost:5173', 'https://project-nomadnest.web.app', 'https://project-nomadnest.firebaseapp.com'],
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
                    secure: process.env.NODE_ENV === 'production' ? true : false,
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                })
                .send({ success: true })
        })

        // Logout
        app.post('/logout', async (req, res) => {
            try {
                res
                    .clearCookie('token', {
                        maxAge: 0,
                        secure: process.env.NODE_ENV === 'production' ? true : false,
                        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                    })
                    .send({ success: true })
                console.log('Logout successful')
            } catch (err) {
                res.status(500).send(err)
            }
        })

        // #AdminHome
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

        // #Admin #Secure
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



        // ManageUsers------------- --------------- -------------
        // get all users data
        // #Admin #Secure
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const size = parseInt(req.query.size)
            const page = parseInt(req.query.page) - 1
            // console.log(size, page)

            const result = await usersCollection
                .find()
                .skip(page * size)
                .limit(size)
                .toArray()
            res.send(result)
        })

        // Get all users data count from db 
        // #Admin #Secure
        app.get('/users-count', verifyToken, verifyAdmin, async (req, res) => {
            const count = await usersCollection.countDocuments()
            res.send({ count })
        })
        // ManageUsers------------- --------------- -------------




        // get a user info by email
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email
            const result = await usersCollection.findOne({ email })
            res.send(result)
        })


        // post related apis 

        // #User #Secure 
        app.post('/posts', verifyToken, async (req, res) => {
            const newPost = req.body
            // console.log(newBook)
            const result = await postsCollection.insertOne(newPost)
            res.send(result)
        })
        // #AdminHome 
        app.get('/all-posts-count', async (req, res) => {
            const result = await postsCollection.find().toArray()
            res.send(result)
        })


        app.delete('/posts/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await postsCollection.deleteOne(query);
            res.send(result);
        });

        // #PostDetails 
        app.get('/post/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await postsCollection.findOne(query);
            // console.log(result);
            res.send(result);
        });

        // about section 3 post get with email 
        // #User #Secure 
        app.get('/my-three-posts', verifyToken, async (req, res) => {
            const email = req.query.email;
            // console.log(email);
            const query = { author_email: email }
            let options = { sort: { post_time: -1 } }
            const result = await postsCollection.find(query, options).limit(3).toArray();
            // console.log(result);
            res.send(result);
        });

        // My Posts------------- --------------- -------------
        // #User #Secure 
        app.get('/posts/:email', verifyToken, async (req, res) => {
            const size = parseInt(req.query.size)
            const page = parseInt(req.query.page) - 1
            // console.log(size, page)
            const query = { author_email: req.params.email }
            // const result = await postsCollection.find().toArray()

            const result = await postsCollection
                .find(query)
                .skip(page * size)
                .limit(size)
                .toArray()
            res.send(result)
        })

        // Get all users data count from db
        // #User #Secure 
        app.get('/my-posts-count', verifyToken, async (req, res) => {
            const query = { author_email: req.query.email }
            // console.log(req.query.email);
            const count = await postsCollection.countDocuments(query)
            res.send({ count })
        })
        // My Posts------------- --------------- -------------


        // search related api 
        // #Home Maybe not in use
        // app.get('/tag-posts', async (req, res) => {
        //     const filter = req.query
        //     // console.log(filter);
        //     const query = {
        //         tag: { $regex: filter.search, $options: 'i' }
        //     }

        //     const options = {
        //         sort: { post_time: -1 }
        //     }

        //     const cursor = postsCollection.find(query, options)
        //     const result = await cursor.toArray()
        //     // console.log(result);
        //     res.send(result)
        // })

        // #Home 
        app.get('/all-posts', async (req, res) => {
            if (!req.query.size) {
                req.query.size = '4'
            }
            if (!req.query.page) {
                req.query.page = '1'
            }
            const size = parseInt(req.query.size);
            const page = parseInt(req.query.page) - 1;
            const sort = req.query.sort;
            const search = req.query.search;
            // console.log(size, page, sort, search);

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
        // #Home 
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

        app.put('/upvote/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await postsCollection.updateOne(query, { $inc: { upvote: +1 } })
            res.send(result);
        });

        app.put('/downvote/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await postsCollection.updateOne(query, { $inc: { downvote: +1 } })
            res.send(result);
        });



        //   comments related apis 
        // #AdminHome 
        app.get('/all-comments', async (req, res) => {
            const result = await commentsCollection.find().toArray()
            res.send(result)
        })

        // #Home
        app.post('/postComments', async (req, res) => {
            const newComment = req.body
            // console.log(newBook)
            const result = await commentsCollection.insertOne(newComment)
            res.send(result)
        })


        // #User #Secure 
        app.patch('/comments/:id', verifyToken, async (req, res) => {
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


        // Comments------------- --------------- ----
        // #User #Secure #Home
        app.get('/comments/:id', async (req, res) => {
            const size = parseInt(req.query.size)
            const page = parseInt(req.query.page) - 1
            const id = req.params.id;
            const query = { post_id: id }
            const result = await commentsCollection
                .find(query)
                .skip(page * size)
                .limit(size)
                .toArray()

            res.send(result)
        })

        app.get('/post-comments-count', async (req, res) => {
            const id = req.query.id;
            const query = { post_id: id }
            const count = await commentsCollection.countDocuments(query)
            res.send({ count })
        })
        // Comments------------- --------------- ----


        // Reported Comments------------- --------------- ----
        // #Admin #Secure
        app.get('/comments', verifyToken, verifyAdmin, async (req, res) => {
            const size = parseInt(req.query.size)
            const page = parseInt(req.query.page) - 1
            // console.log(size, page)
            const query = { feedback: { $exists: true, $ne: null, $ne: false } };

            const result = await commentsCollection
                .find(query)
                .skip(page * size)
                .limit(size)
                .toArray()
            res.send(result)
        })

        // Get comments data count from db
        // #Admin #Secure
        app.get('/comments-count', verifyToken, verifyAdmin, async (req, res) => {
            const query = { feedback: { $exists: true, $ne: null, $ne: false } };
            const count = await commentsCollection.countDocuments(query)
            res.send({ count })
        })
        // Reported Comments------------- --------------- ----





        //   announcements related apis 
        // #Admin #Secure
        app.post('/announcements', verifyToken, verifyAdmin, async (req, res) => {
            const newPost = req.body
            // console.log(newBook)
            const result = await annCollection.insertOne(newPost)
            res.send(result)
        })


        // violation warning related apis 
        // #Admin #Secure
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

        // #Admin #Secure 
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
        // #Home #User
        app.get('/tags', async (req, res) => {
            const result = await tagsCollection.find().toArray()
            res.send(result)
        })

        // #AdminHome  
        app.post('/add-tags', verifyToken, verifyAdmin, async (req, res) => {
            const tag = req.body;
            const result = await tagsCollection.insertOne(tag);
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
            // console.log(result);
            res.send(result);
        })





        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
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
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})