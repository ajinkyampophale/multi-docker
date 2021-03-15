const express = require("express"),
  redis = require("redis"),
  cors = require("cors"),
  {Pool} = require("pg"),
  app = express(),
  {redisHost, redisPort, pgUser, pgHost, 
    pgDatabase, pgPassword, pgPort} = require("./keys");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: false}));

// postgres setup
const pgClient = new Pool({
  user: pgUser,
  host: pgHost,
  database: pgDatabase,
  password: pgPassword,
  port: pgPort
});

pgClient.on("connect", () => {
  console.log("Creating tables...");
  pgClient
    .query('CREATE TABLE IF NOT EXISTS values (number INT)')
    .catch((err) => console.log(err));
}); 

// redis setup
const redisClient = redis.createClient({
  host: redisHost,
  port: redisPort,
  retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate();

// all routes
app.get("/values/all", async (req, res) => {
  
  const values = await pgClient.query("Select * from values");

  res.send(values.rows);
});

app.get("/values/current", (req, res) => {

  redisClient.hgetall("values", (err, values) => {
    res.send(values);
  });
});

app.post("/values", async (req, res) => {
  
  const {index} = req.body;

  if(parseInt(index) > 40){
    return res.status(422).send("Index too high!!");
  }

  redisClient.hset("values", index, "Nothing yet!");
  
  redisPublisher.publish('insert', index);

  pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

  res.send({working: true});
});

const PORT = 5000;
app.listen(PORT, (err) => {
  if(err){
    console.log(err);
    process.exit(0);
  }
  console.log(`Listening on port ${PORT}`);
});