const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());



// connection db
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.etkkvpu.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// middleware
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

async function run() {
    try {
        const categoriesCollection = client.db('exDesktopAccessories').collection('categories');
        const usersCollection = client.db('exDesktopAccessories').collection('users');
        const ordersCollection = client.db('exDesktopAccessories').collection('orders');
        // google login or signup

        // Signup user, seller
        app.post('/google', async (req, res) => {
            let token;
            const { email, name, role } = req.body;
            const user = {
                name, email, role, provider: 'google', isVerified: false
            }

            const existUser = await usersCollection.findOne({ email: email, provider: 'google' });

            if (!existUser) {
                const result = await usersCollection.insertOne(user);
                const newUser = await usersCollection.findOne({ _id: result.insertedId });
                token = jwt.sign({ _id: newUser._id, name: newUser.name }, process.env.USER_ACCESS_Token);
                return res.status(200).json({
                    name: newUser.name,
                    email: newUser.email,
                    role: role,
                    token: token
                });
            }

            token = jwt.sign({ _id: existUser._id, name: existUser.name }, process.env.USER_ACCESS_Token);

            res.status(200).json({
                name: existUser.name,
                email: existUser.email,
                role: role,
                token: token
            });
        });

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
        // userMiddleWare
        app.get('/categories', async (req, res) => {
            const query = {};
            const categories = await categoriesCollection.find(query).toArray();
            res.status(200).send(categories);
        });

        // get one category
        app.get('/category/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: ObjectId(id) };
            console.log(query);
            const category = await categoriesCollection.findOne(query);
            res.status(200).send(category);
        });

        // order product
        app.post('/order/:productId', userMiddleWare, async (req, res) => {
            const { productId } = req.params;
            const { categoryId, phone_number, meeting_location } = req.body;
            const data = {
                product_id: productId,
                category_id: categoryId,
                phone_number,
                meeting_location
            }
            const order = await ordersCollection.insertOne(data);
            res.status(200).send(order);
        });


        // For Seller
        // app.post('/category', async (req, res) => {
        //     const { name, img } = req.body;

        //     const categoryData = { name, img };
        //     const category = await categoriesCollection.insertOne(categoryData);
        //     res.status(201).send(category);
        // });

        // advertised productData
        app.get('/product/advertised', async (req, res) => {
            const query = {
                $project: {
                    products: {
                        $filter: {
                            input: "$products",
                            as: "product",
                            cond: { $eq: ["$$product.isAdvertised", true] }
                        }
                    }
                }
            }
            const categories = await categoriesCollection.aggregate([query]).toArray();
            res.status(200).send(categories);
        });

        // seller productData
        app.get('/product', sellerMiddleWare, async (req, res) => {
            const sellerName = req.seller.name;
            const query = {
                $project: {
                    products: {
                        $filter: {
                            input: "$products",
                            as: "product",
                            cond: { $eq: ["$$product.seller_name", `${sellerName}`] }
                        }
                    }
                }
            }
            const categories = await categoriesCollection.aggregate([query]).toArray();
            res.status(200).send(categories);
        });

        // Product creation for seller
        app.put('/category/:id/product', sellerMiddleWare, async (req, res) => {
            const categoryId = req.params.id;
            const { p_name, p_img, resale_price, original_price, condition_type, phone_number, location, year_of_use, description } = req.body;

            const productData = { _id: ObjectId(req.seller._id), p_name, p_img, description, resale_price, original_price, year_of_use, condition_type, phone_number, seller_location: location, seller_name: req.seller.name, isAvailable: true, isAdvertised: false, created_at: new Date(), update_at: new Date() };
            const category = await categoriesCollection.updateOne({ _id: ObjectId(categoryId) }, {
                $push: { "products": productData }
            });

            res.status(200).send(category);
        });

        // Product update for seller
        app.put('/category/:id/product/:productId/advertise', sellerMiddleWare, async (req, res) => {
            const categoryId = req.params.id;
            const productId = req.params.productId;
            console.log(categoryId, productId);
            const product = await categoriesCollection.updateOne(
                { _id: ObjectId(categoryId), "products._id": ObjectId(productId) },
                { $set: { "products.$.isAdvertised": true } }
            );

            console.log(product);

            res.status(200).send(product);
        });

        // admin api
        // seller verification
        // adminMiddleWare
        app.put('/seller/:id', async (req, res) => {
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