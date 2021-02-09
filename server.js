const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const MongoClient = require("mongodb").MongoClient;
const countries = require("./countries.json");
const { encrypt } = require("./crypto");
const https = require("https");
require("dotenv").config();

const MONGO_URL = process.env.MONGO_DB_URI || "mongodb://localhost:27017/";
const PORT = process.env.PORT || 5000;
const app = express();
app.use(cors("*"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static("./build"));

function buildPhotoReferenceURL(html_attribution, photo_reference) {
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo_reference}&key=${process.env.GOOGLE_API_KEY}`;
  return `<div><ol>
  <li>
  <img src="${url}"/>
  </li>
  <li></ul>${html_attribution}</li>
  </ol></div>`;
}

MongoClient.connect(MONGO_URL, (err, client) => {
  if (err) {
    console.log(err);
    return;
  }
  const db = client.db("european-capitals-db");

  if (db) {
    db.collection("countries")
      .find()
      .toArray((err, result) => {
        if (err) {
          console.log(err);
          return;
        }

        if (result.length < 1) {
          db.createCollection("countries");
          db.createCollection("scores");
          db.collection("countries").insert(countries, (err, res) => {
            if (err) {
              console.log(err);
              return;
            }
          });
        }
      });
  }

  app
    .get("/api/search/places", (req, res) => {
      const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?inputtype=textquery&locationbias=point:${req.query.lat},${req.query.lng}&fields=photos&input=${req.query.place}&key=${process.env.GOOGLE_API_KEY}`;
      let data = "";
      https.get(url, (response) => {
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          if (
            data &&
            JSON.parse(data).candidates &&
            JSON.parse(data).candidates.length > 0
          ) {
            let responseData = JSON.parse(data).candidates[0].photos[0];
            res.json(
              buildPhotoReferenceURL(
                responseData.html_attributions[0],
                responseData.photo_reference
              )
            );
          }
        });
      });
    })
    .on("error", (err) => {
      console.log("Error: " + err.message);
    });

  app.get("/api/crypto", function (req, res) {
    if (process.env.ALGORITHM && process.env.SECRET_KEY) {
      res.json({
        crypto: {
          algo: process.env.ALGORITHM,
          skey: process.env.SECRET_KEY,
        },
      });
    } else {
      res.json("Not available.");
    }
  });

  app.get("/api/google", function (req, res) {
    if (process.env.GOOGLE_API_KEY) {
      res.json({
        api: encrypt(
          JSON.stringify({
            gkey: process.env.GOOGLE_API_KEY,
            wkey: process.env.OPEN_WEATHER_API_KEY,
          })
        ),
      });
    } else {
      res.json("Not available.");
    }
  });

  app.get("/api/countries", function (req, res) {
    db.collection("countries")
      .find()
      .toArray(function (err, result) {
        if (err) {
          console.log(err);
          res.status(500);
          res.send();
          return;
        }
        res.json(result);
      });
  });

  app.get("/api/countries/random", function (req, res) {
    db.collection("countries")
      .find({})
      .toArray(function (err, result) {
        if (err) {
          console.log(err);
          res.status(500);
          res.send();
          return;
        }

        const randomCountry = result[Math.floor(Math.random() * result.length)];

        res.json(randomCountry);
      });
  });

  app.post("/api/scores", function (req, res) {
    db.collection("scores").insert(req.body, function (err, result) {
      if (err) {
        console.log(err);
        res.status(500);
        res.send();
        return;
      }

      res.status(201);
      res.json(result.ops[0]);
    });
  });

  app.get("/api/scores", function (req, res) {
    db.collection("scores")
      .find({})
      .sort({ score: -1 })
      .toArray(function (err, result) {
        if (err) {
          console.log(err);
          res.status(500);
          res.send();
          return;
        }

        res.status(200).json(result);
      });
  });

  app.delete("/api/scores", function (req, res) {
    db.collection("scores").remove({}, function (err, result) {
      if (err) {
        console.log(err);
        res.status(500);
        res.send();
        return;
      }

      res.status(204);
      res.send();
    });
  });

  console.log("Connected to DB");
  console.log("Starting server...");

  app.listen(PORT, function () {
    console.log(`Server started on ${PORT}`);
  });
});
