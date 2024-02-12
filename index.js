import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

const app = express();
const port = 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Set the 'public' folder as the location for serving static files
app.use(express.static(path.join(__dirname, "public")));

// Mounting the body-parser middleware for parsing JSON and URL-encoded bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

async function connectToMongoDB() {
  try {
    await mongoose.connect(process.env.DATABASE_URI, {
      // Caution: Only for debugging, not recommended for production
      serverSelectionTimeoutMS: 3000, // Time out set to 3 seconds for quick debugging
    });
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Unable to connect to MongoDB: ", error);
  }
}

connectToMongoDB();

// Create Schema for Exercises
const ExerciseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  description: String,
  duration: Number,
  date: { type: Date, default: Date.now },
});

// Create Schema for Users
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: false },
  log: [ExerciseSchema],
});

// Create Exercise model
const Exercise = mongoose.model("Exercise", ExerciseSchema);
// Create User model
const User = mongoose.model("User", UserSchema);

// Function to generate sample users and exercises
const createSampleData = async () => {
  try {
    // Create 5 sample users
    const users = await User.create([
      { username: "User1" },
      { username: "User2" },
      { username: "User3" },
      { username: "User4" },
      { username: "User5" },
    ]);

    // Create 10 sample exercises for each user
    for (const user of users) {
      const exercises = [];
      for (let i = 0; i < 10; i++) {
        exercises.push({
          userId: user._id,
          description: `Exercise ${i + 1} for ${user.username}`,
          duration: Math.floor(Math.random() * 60) + 1, // Random duration between 1 and 60 minutes
          date: new Date(),
        });
      }
      await Exercise.insertMany(exercises);
    }

    console.log("Sample data created successfully.");
  } catch (error) {
    console.error("Error creating sample data:", error);
  } finally {
    mongoose.disconnect();
  }
};

async function deleteMany() {
  // Delete many based on criteria
  await User.deleteMany({ username: { $regex: /test/i } });
}

// deleteMany();

// Connect to MongoDB and create sample data
// createSampleData();

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

//////////////////////////////////////////////////////////////////////////////////
// POST "/api/users"
//
////////////////////////////////////////////////////////////////////////////////
app.post("/api/users", async (req, res) => {
  // POST to create new user
  // RESPONSE username and _id

  // Extract the username from the request body.
  const newUsername = req.body.username;

  try {
    // Create a new user in the database with this username.
    const { username, _id } = await User.create({ username: newUsername });

    // Return the newly created user's username and _id.
    res.json({ username: username, _id: _id });
  } catch (error) {
    console.log("Unable to create new user: ", error);
    if (error.code === 11000 || error.code === 11001) {
      res.json({ message: "Duplicate record." });
    } else {
      res.json({ message: "Unable to create new user." });
    }
  }
});

//////////////////////////////////////////////////////////////////////////////////
// GET "/api/users"
//
////////////////////////////////////////////////////////////////////////////////
app.get("/api/users", async (req, res) => {
  // GET to list all users
  // Return an array
  // object literal containing a user's username and _id
  // RESPONSE

  try {
    // GET /api/users (List All Users):
    // Retrieve all users from the database.
    const allUsers = await User.find();

    // Create array
    const usernames = [];

    // Create an array to store user objects with username and _id.
    const userArray = allUsers.map((user) => {
      return {
        username: user.username,
        _id: user._id,
        __v: user.__v,
      };
    });
    // Return an array of user objects, each containing the user's username and _id.
    res.json(userArray);
  } catch (error) {
    console.log("Unable to fetch all users: ", error);
    res.json("Unable to fetch all users.");
  }
});

//////////////////////////////////////////////////////////////////////////////////
// POST "/api/users/:_id/exercises"
//
////////////////////////////////////////////////////////////////////////////////
app.post("/api/users/:_id/exercises", async (req, res) => {
  // POST form data description, duration, and optionally date. If no date is supplied, the current date will be used.
  // RESPONSE returned from POST /api/users/:_id/exercises will be the user object with the exercise fields added.
  //POST /api/users/:_id/exercises (Add Exercise to User):

  // Extract the user _id from the URL parameters.
  // Extract exercise data (description, duration, date) from the request body.
  let { description, duration, date } = req.body;
  let { _id } = req.params;

  // Check date is correctly formatted
  function isDateFormatValid(dateString) {
    // Define a regex pattern for yyyy-mm-dd format
    const regexPattern = /^\d{4}-\d{2}-\d{2}$/;

    // Use regex test method to check if the string matches the pattern
    return regexPattern.test(dateString);
  }
  function isValidDuration(duration) {
    // Check if the duration is a number and within the range 0 to 600 (inclusive)
    const numericValue = parseInt(duration, 10);
    return !isNaN(numericValue) && numericValue >= 0 && numericValue <= 600;
  }

  // If no date is provided, use the current date.
  if (!date) {
    // Create a new Date object for the current date
    const currentDate = new Date();

    // Extract the year, month, and day components
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0"); // Month is zero-based
    const day = String(currentDate.getDate()).padStart(2, "0");

    // Format the date as yyyy-mm-dd
    date = `${year}-${month}-${day}`;
  }
  // Call to check if fate is correctly formatted
  if (!isDateFormatValid(date))
    return res.json(`The date "${date}" is not in the correct format.`);
  if (!duration || !description) return res.json("Missing fields.");
  if (!isValidDuration(duration))
    return res.json(
      `The duration "${duration}" is not valid; must be in minutes`
    );

  // Add the exercise to the specified user's record in the database.
  try {
    const user = await User.findOne({ _id: _id });

    if (!user) {
      return res.json("User not found.");
    }

    const newExercise = await Exercise.create({
      userId: _id,
      description: description,
      duration: duration,
      date: date,
    });

    user.log.push(newExercise);

    await user.save();
  } catch (error) {
    console.log("Error adding exercise: ", error);
    return res.json("Unable to add exercise.");
  }

  try {
    const user = await User.findOne({ _id: _id });

    if (!user) return res.json({ message: "User not found." });

    // Get the last log entry
    const lastLogEntry = user.log[user.log.length - 1];

    // Return the user object including the newly added exercise information.
    return res.json({
      _id: user._id,
      username: user.username,
      date: lastLogEntry.date,
      duration: lastLogEntry.duration,
      description: lastLogEntry.description,
    });
  } catch (error) {
    console.log("Error getting user las log data: ", error);
    return res.json("Could not get user las log data.");
  }
});

//////////////////////////////////////////////////////////////////////////////////
// GET "/api/users/:_id/logs"
//
////////////////////////////////////////////////////////////////////////////////
app.get("/api/users/:_id/logs", (req, res) => {
  // make a GET request to /api/users/:_id/logs to retrieve a full exercise log of any user.
  // A request to a user's log GET /api/users/:_id/logs returns a user object with a count property representing the number of exercises that belong to that user.
  // A GET request to /api/users/:_id/logs will return the user object with a log array of all the exercises added.
  // Each item in the log array that is returned from GET /api/users/:_id/logs is an object that should have a description, duration, and date properties.
  // The description property of any object in the log array that is returned from GET /api/users/:_id/logs should be a string.
  // The duration property of any object in the log array that is returned from GET /api/users/:_id/logs should be a number.
  // The date property of any object in the log array that is returned from GET /api/users/:_id/logs should be a string. Use the dateString format of the Date API.
  // You can add from, to and limit parameters to a GET /api/users/:_id/logs request to retrieve part of the log of any user. from and to are dates in yyyy-mm-dd format. limit is an integer of how many logs to send back.

  //GET /api/users/:_id/logs (Retrieve User's Exercise Log):
  // Extract the user _id and optional from, to, and limit parameters from the URL.
  // Retrieve the user's exercise log from the database.
  // If from and to parameters are provided, filter the log by the date range.
  // If limit is provided, limit the number of log entries returned.
  // Return the user object with the log array and a count of the total exercises.

  res.json("GET- /api/users/:_id/logs");
});

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
