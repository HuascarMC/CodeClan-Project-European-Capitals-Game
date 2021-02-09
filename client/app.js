const MapWrapper = require("./models/MapWrapper");
const Modal = require("./models/Modal");
const Score = require("./score");
const Request = require("./services/request");
const geojson = require("geojson-tools");
const speech = window.speechSynthesis;
const NewsView = require("./views/newsView");
const ScoreView = require("./views/scoreView");
const { load } = require("google-maps");
const { decrypt } = require("../crypto");

let countryMap;
let country;
let currentWeather;
let weatherIcon;
let modal;
let playerScore;
let playerName;
let scores;
let news;
let token;
let crypto;
let image;

let url = window.location;
let voiceEnabled = true;
let nightModeEnabled = false;
let numberOfQuestions = 7;
let numberOfQuestionsInput;
let questionCount = 0;

document.addEventListener("DOMContentLoaded", function () {
  const voiceToggleElement = document.getElementById("voice-toggler");

  numberOfQuestionsInput = document.getElementById("levels-input");
  numberOfQuestionsInput.value = numberOfQuestions;

  const nightModeToggler = document.getElementById("night-mode-toggler");

  voiceToggleElement.addEventListener("click", function () {
    voiceEnabled = !voiceEnabled;
    if (voiceEnabled) {
      voiceToggleElement.classList.remove("disabled");
      voiceToggleElement.classList.add("enabled");
    } else {
      voiceToggleElement.classList.remove("enabled");
      voiceToggleElement.classList.add("disabled");
    }
  });

  numberOfQuestionsInput.addEventListener("change", function (event) {
    numberOfQuestions = event.target.value;
  });

  nightModeToggler.addEventListener("change", function (e) {
    nightModeEnabled = !nightModeEnabled;

    if (!nightModeEnabled) {
      countryMap.setDayMode();
    } else {
      countryMap.setNightMode();
    }
  });
});

const app = function () {
  getCrypto(() => {
    getToken(() => {
      initialize(48.21, 16.37, token || "");
      modal = new Modal({
        title: "Where on Earth? (Europe Edition)",
        body:
          "<div>" +
          "<p> Guess where the capitals are to win big and learn some fun facts. </p></div>" +
          "<h1 class='title'> How to play: </h1>" +
          "<p><span style='font-weight: bold; color: black;'>1.</span> Enter your name then press the start button below. </p>" +
          "<p> <span style='font-weight: bold; color: black;'>2.</span> When the game starts a city name will show, try and find it on the map. </p>" +
          "<p> <span style='font-weight: bold; color: black;'>3.</span> Click and place your marker where you think it is. </p>" +
          "<p> <span style='font-weight: bold; color: black;'>4.</span> See how close you got and your score. </p>" +
          "<form><input id='name' maxlength='50' placeholder='Enter name here'></form>",
        buttons: {
          action: {
            label: "Start Game",
            fn: function () {
              playerName = document.querySelector("#name").value;
              playerScore = new Score(playerName);
              loadQuestion();
              modal.hide();
            },
          },
        },
      });
      modal.show();
      // request.get(getScores);
    });
  });
};

const initialize = async function (lat, lng, token) {
  let center = { lat, lng };
  let mapDiv = document.getElementById("map");
  getScores();
  // const newsView = new NewsView();
  countryMap = new MapWrapper(
    mapDiv,
    center,
    5,
    token,
    crypto,
    function (attempt) {
      if (questionCount < numberOfQuestions) {
        const countryLocation = [
          country.geometry.coordinates[1],
          country.geometry.coordinates[0],
        ];

        const distance = geojson.getDistance([attempt, countryLocation]);
        // getNews(country);
        countryMap.setCapitalMarker(countryLocation);

        modal.set({
          title: playerScore.getTitle(distance),
          body: `
          ${image}
          <p><img src=${weatherIcon}> ${currentWeather}</p>
          <p>${distance} km away.</p>
          <p>You scored <span>${playerScore.calculate(distance)}</span></p>
          <p>Your total so far is <span>${playerScore.getTotal()}</span></p>
          <p class='background-fact'>${country.history}</p>
        `,
          buttons: {
            action: {
              label: "Next",
              fn: function () {
                modal.hide();
                speech.cancel();
                questionCount++;
                if (questionCount == numberOfQuestions) {
                  gameEnd(playerScore.getTotal());
                  return;
                }
                loadQuestion();
              },
            },
            // close: {
            //  label: "Show News",
            //  fn: function(){
            //   console.log(news);
            //    modal.hide();
            //    modal.set({
            //      title: `News for ${country.properties.country}`,
            //      body: newsView.createNewsboard(news),
            //    });
            //    modal.show();
            //  }
            // }
          },
        });
        modal.show();
        if (voiceEnabled) {
          console.log(speech.getVoices());
          const readText = new SpeechSynthesisUtterance(country.history);
          readText.voice = speech.getVoices()[0];
          speech.speak(readText);
        }
      }
    }
  );
};

const loadQuestion = function () {
  // countryMap.setNightMode();
  const request = new Request();
  request.getRandomCountry(function (countryInfo) {
    if (country !== countryInfo) {
      createCard(countryInfo);
      country = countryInfo;
      getPhotos(country);
      const title = document.querySelector(".title");
      title.innerHTML =
        `${questionCount + 1}. Where is ` + country.properties.capital + "?";
    } else {
      loadQuestion();
    }
  });
};

const createCard = function (country) {
  const request = new Request(
    `http://api.openweathermap.org/data/2.5/weather?q=${
      country.properties.capital
    }&units=metric&APPID=${JSON.parse(decrypt(token.api, crypto)).wkey}`
  );
  request.get(function (body) {
    currentWeather = "Temperature: " + body.main.temp + "°";
    weatherIcon =
      "http://openweathermap.org/img/w/" + body.weather[0].icon + ".png";
  });
};

const gameEnd = function (score) {
  const scoreView = new ScoreView();
  modal.set({
    title: "Game Over!",
    body: `<p id='score-title'>Score</p> <p id='final-score'>${score}</p>`,
    buttons: {
      action: {
        label: "Play Again?",
        fn: function () {
          modal.hide();
          loadQuestion();
          playerScore.total = 0;
          questionCount = 0;
        },
      },
      close: {
        label: "Show Scores",
        fn: function () {
          modal.hide();
          modal.set({
            title: "Leader Board",
            body: scoreView.createLeaderboard(scores),
            buttons: {
              close: null,
              action: {
                label: "Play Again?",
                fn: function () {
                  modal.hide();
                  loadQuestion();
                  playerScore.total = 0;
                  questionCount = 0;
                },
              },
            },
          });
          modal.show();
        },
      },
    },
  });
  playerScore.saveScore();
  getScores();
  modal.show();
};

const getCrypto = function (callback) {
  const request = new Request(url.protocol + "//" + url.host + "/api/crypto");
  request.get((body) => {
    crypto = body;
    callback();
  });
};

const getToken = function (callback) {
  const request = new Request(url.protocol + "//" + url.host + "/api/google");
  request.get((body) => {
    token = body;
    callback();
  });
};

const getScores = function () {
  const request = new Request(url.protocol + "//" + url.host + "/api/scores");
  request.get(function (body) {
    scores = body;
  });
};

const getPhotos = function (country) {
  const request = new Request(
    url.protocol +
      "//" +
      url.host +
      `/api/search/places?place=${country.properties.capital}&lat=${country.geometry.coordinates[0]}&lng=${country.geometry.coordinates[1]}`
  );
  request.get(function (body) {
    image = body;
  });
};

// const getNews = function(country) {
//  const request = new Request('https://newsapi.org/v2/everything?sources=bbc-news,daily-mail,google-news-uk&page=5&sortBy=relevancy&language=en&' + `q=${country.properties.country}` + '&apiKey=526a0f58261340d58af4d6569c12859e')
//
//  request.get(function(body) {
//   news = body;
//   console.log(body);
//  });
// };

document.addEventListener("DOMContentLoaded", app);
