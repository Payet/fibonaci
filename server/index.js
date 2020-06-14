const keys = require('./keys');

// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres Client Setup
const { Pool } = require('pg');
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort
});
pgClient.on('error', () => console.log('Lost PG connection'));

pgClient
  .query('CREATE TABLE IF NOT EXISTS values (number INT)')
  .catch(err => console.log(err));

// Redis Client Setup
console.log("Before Redis connection");
const redis = require('redis');
const redisClient = redis.createClient({
  //host: keys.redisHost,
  //port: keys.redisPort,
  host: 'multi-docker-redis.qcxzjs.0001.euc1.cache.amazonaws.com',
  port: 6379,
  retry_strategy: () => 1000
});

console.log("After Redis connection");
//client.set("mykey", "value22", redis.print);
//client.get("mykey", redis.print);

//redisClient.on('error', () => console.log('Redis client connection error'));
redisClient.on('error', function(err) {
     console.log('Redis client connection error: ' + err);
});
redisClient.on('connect', function() {
    console.log('Redis client connected');
});

const redisPublisher = redisClient.duplicate();

// Express route handlers

app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * from values');

  res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
  console.log('Retrieving current values from Redis...')
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
  console.log('Current values try logic completed...' + new Date().getTime())
});

app.post('/values', async (req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high');
  }

  console.log("Putting value into Redis: " + index);
  redisClient.hset('values', index, 'Nothing yet!');
  console.log("Getting value from Redis: " + index);
  // just returns the name of the hash
  redisClient.hget("values", index, function (err, obj) {
     console.log("HGET: "+obj);
  });

  redisPublisher.publish('insert', index);
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);


  res.send({ working: true });
});

app.listen(5000, err => {
  console.log('Listening');
});
