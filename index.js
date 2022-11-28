const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.etkkvpu.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const randomStr = () => require('crypto').randomBytes(64).toString('hex');
async function run() {
    try {
        const categoriesCollection = client.db('exDesktopAccessories').collection('categories');
        const usersCollection = client.db('exDesktopAccessories').collection('users');

        // user authentication
        const userMiddleWare = async (req, res, next) => {
            try {
                const bearerToken = req.headers.authorization;
                if (!bearerToken) return res.status(404).send("No token found");
                const token = bearerToken.replace('Bearer ', '');
                if (!token) return res.status(401).send("Unauthorized");
                const isVerified = await jwt.verify(token, process.env.USER_ACCESS_Token);
                if (!isVerified) return res.status(401).send("Unauthorized");
                req.user = isVerified;
                next();
            } catch (error) {
                res.status(401).send("Unauthorized");
            }
        }

        // seller authentication
        const sellerMiddleWare = async (req, res, next) => {
            try {
                console.log(process.env.ADMIN_ACCESS_Token);
                const bearerToken = req.headers.authorization;
                if (!bearerToken) return res.status(404).send("No token found");
                const token = bearerToken.replace('Bearer ', '');
                console.log(token);
                if (!token) return res.status(401).send("Unauthorized");
                const isVerified = await jwt.verify(token, process.env.SELLER_ACCESS_Token);
                if (!isVerified) return res.status(401).send("Unauthorized");
                req.seller = isVerified;
                next();
            } catch (error) {
                res.status(401).send("Unauthorized");
            }
        }

        // admin authentication
        const adminMiddleWare = async (req, res, next) => {
            try {
                const bearerToken = req.headers.authorization;
                console.log(process.env.ADMIN_ACCESS_Token);
                if (!bearerToken) return res.status(404).send("No token found");
                const token = bearerToken.replace('Bearer ', '');
                if (!token) return res.status(401).send("Unauthorized");
                const isVerified = await jwt.verify(token, process.env.ADMIN_ACCESS_Token);
                if (!isVerified) return res.status(401).send("Unauthorized");
                req.admin = isVerified;
                next()
            } catch (error) {
                res.status(401).send("Unauthorized");
            }
        }

        // Signup user, seller
        app.post('/signup', async (req, res) => {
            const { email, name, role } = req.body;
            const user = {
                name, email, role, isVerified: false
            }
            const result = await usersCollection.insertOne(user);
            const newUser = await usersCollection.findOne({ _id: result.insertedId });
            res.send(newUser);
        });

        // Login user, seller
        app.post('/login', async (req, res) => {
            const { email, role } = req.body;
            let token;

            const user = await usersCollection.findOne({ email: email, role: role });
            if (!user) return res.status(404).send('User not found');

            if (role === 'user') {
                token = jwt.sign({ _id: user._id, name: user.name }, process.env.USER_ACCESS_Token);
            } else if (role === 'seller') {
                token = jwt.sign({ _id: user._id, name: user.name }, process.env.SELLER_ACCESS_Token);
            } else if (role === 'admin') {
                token = jwt.sign({ _id: user._id, name: user.name }, process.env.ADMIN_ACCESS_Token);
            }

            res.status(200).send({
                name: user.name,
                email: user.email,
                role: role,
                token: token
            });
        });

        // categories
        app.get('/categories', userMiddleWare, async (req, res) => {
            const query = {};
            const categories = await categoriesCollection.find(query).toArray();
            res.status(200).send(categories);
        });

        // get one category
        app.get('/category/:id', async (req, res) => {
            const { id } = req.params;

            const query = { _id: ObjectId(id) };
            const category = await categoriesCollection.findOne(query);
            res.status(200).send(category);
        });


        // For Seller
        // app.post('/category', async (req, res) => {
        //     const { name, img } = req.body;

        //     const categoryData = { name, img };
        //     const category = await categoriesCollection.insertOne(categoryData);
        //     res.status(201).send(category);
        // });

        // Product creation for seller
        app.put('/category/:id/product', sellerMiddleWare, async (req, res) => {
            const categoryId = req.params.id;
            const { p_name, p_img, resale_price, original_price, condition_type, phone_number, seller_location, year_of_use } = req.body;

            const productData = { _id: req.seller._id, p_name, p_img, resale_price, original_price, year_of_use, condition_type, phone_number, seller_location, name: req.seller.name, created_at: new Date(), update_at: new Date() };
            const category = await categoriesCollection.updateOne({ _id: ObjectId(categoryId) }, {
                $push: { "products": productData }
            });

            res.status(200).send(category);
        });


        // admin api
        // seller verfication
        app.put('/seller/:id', [adminMiddleWare], async (req, res) => {
            const sellerId = req.params.id;
            const { isVerified } = req.body;

            const seller = await usersCollection.updateOne({ _id: ObjectId(sellerId) }, {
                $set: { "isVerified": isVerified }
            });

            res.status(200).send(seller);
        });
    }
    finally {

    }
}
run().catch(error => console.error());


app.get('/', async (req, res) => {
    res.send('Recycle server is running')
})

app.listen(port, () => {
    console.log(`Recycle Running On ${port}`);
})