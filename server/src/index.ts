import fs from 'fs'

import dotenv from 'dotenv';

import express, { Express } from 'express';
import cors from 'cors';
import session from 'express-session'
import morgan from 'morgan'

import { MongodbPersistence } from "y-mongodb-provider";

import { connect as mongoConnect } from 'mongoose'
import MongoStore from 'connect-mongo'

import { Client as ElasticClient } from '@elastic/elasticsearch'
import { createIndicies } from './db/elasticsearch';

import users from './routes/users'
import collection from './routes/collections'
import media from './routes/media'
import api from './routes/api'
import index from './routes/index'

//promises that need to be resolved before server starts
const promises: Promise<any>[] = []

// Allow for interaction with dotenv
dotenv.config();

const { PORT, COLLECTION, DB, DB_USER, DB_PASS, DB_HOST, DB_PORT, SECRET_KEY, ELASTICSEARCH_PASS } = process.env;

const mongostr = `mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB}?authSource=admin`
console.log(mongostr)

//MONGO + YJS
export const ymongo = new MongodbPersistence(mongostr, {
    collectionName: COLLECTION
});

mongoConnect(mongostr, (val) => console.log(val ?? "connected to docs db"));

//ELASTICSEARCH
export const elastic_client = new ElasticClient({
    node: 'https://localhost:9200',
    auth: {
        username: 'elastic',
        password: ELASTICSEARCH_PASS as string
    },
    tls: {
        ca: fs.readFileSync('/root/http_ca.crt'),
        rejectUnauthorized: false
    }
})

promises.push(createIndicies())

// EXPRESS
const app: Express = express();

app.set('trust proxy', 1)
app.use(cors({ credentials: true }));

// JSON Middleware
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }));
app.use(cors())

//Cookie-based sessions
app.use(session({
    name: 'mahirjeremy-connect.sid',
    resave: true,
    saveUninitialized: true,
    secret: SECRET_KEY,
    httpOnly: false,
    store: MongoStore.create({
        mongoUrl: mongostr,
        autoRemove: 'interval',
        autoRemoveInterval: 1,
        ttl: 30 * 60 // = 30 minutes

    }),
    proxy: true,
    cookie: {
        domain: "mahirjeremy.cse356.compas.cs.stonybrook.edu"
    }
} as any))

//logger
app.use(morgan("dev"))

//routes
app.use('/users', users)
app.use('/collection', collection)
app.use('/media', media)
app.use('/api', api);
app.use('/index', index);

//only start server once all promises are resolved
Promise.all(promises).then(() => {
    app.listen(PORT, async () => {
        console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
    })
})
