import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import Joi from "joi";
import dayjs from "dayjs";

const app = express();

//Config.
app.use(express.json());
app.use(cors());
dotenv.config();

//Connection to mongodb
const mongoClient = new MongoClient(process.env.DATABASE_URL);
try{
    await mongoClient.connect();
    console.log("MongoDB is connected");
} catch (err){
    console.log(err.message);
}
const db = mongoClient.db();

//Validation
const schemaName = Joi.object({
    name:  Joi.string()
        .min(1)
        .required(),
});

const schemaMessage = Joi.object({
    from: Joi.string().required(),
    to: Joi.string().min(1).required(),
    text: Joi.string().min(1).required(),
    type: Joi.any().valid('message', 'private_message').required(),
    time: Joi.required(),
});

//EndPoints
app.post("/participants", async (req, res) => {
    const {name} = req.body;

    const {error} = schemaName.validate({name});
    if(error) return res.status(422).send(error.details[0].message);

    try{
        const nameUsed = await db.collection('participants').findOne({name: name});
        if( nameUsed ) return res.status(409).send('Nome de usuário já existe.');

        await db.collection('participants').insertOne( {name, lastStatus: Date.now()} );
        await db.collection('messages').insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        });
        res.sendStatus(201);
    } catch (error){
        res.status(500).send(error.message);
    }
})

app.post("/messages", async (req, res) =>{
    const { to, text, type } = req.body;
    const from = req.headers.user;
    
    const message = {
        from,
        to,
        text,
        type,
        time: dayjs().format('HH:mm:ss')
    };
    const {error} = schemaMessage.validate(message);
    if(error) return res.status(422).send(error.details[0].message);

    try{
        const sender = await db.collection('participants').findOne({name: from});

        if(!sender) return res.status(422).send("Usuário não encontrado.");

        await db.collection('messages').insertOne(message);
        res.sendStatus(201);
    } catch (error){
        res.status(500).send(error.message);   
    }
})

app.get("/participants", async (req, res) => {
    try{
        const participats = await db.collection('participants').find().toArray();
        res.send(participats);
    } catch (error){
        res.status(500).send(error.message);
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`server running on port ${PORT}`));