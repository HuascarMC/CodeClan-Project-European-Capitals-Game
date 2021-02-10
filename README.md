# European Capitals Game

Play the game [here](https://european-capitals.herokuapp.com/), allow a few seconds
to wake up the server if it's been idling for a while.

## Purpose

A game to practice your geography skills by selecting the correct location
of a country's capital city on the map. Users are given points based on how
far their guesses are from the requested city. Scores are saved using Cloud MongoDB
to allow for a leaderboard to be displayed. A historical brief will be read to you with
speech that can be turned off.

## MVP

- Display a map to the user
- Ask the user to find a random capital city
- Allow the user to place a marker anywhere on the map
- Display a screen telling the user how far away their guess was from the city
- Display information about the city
- Have a database of city locations and its history

## How to run the app locally.

You will need NodeJS and MongoDB

- npm install
- run - mongod
- npm run build
- npm start
- run on - Localhost:5000/
