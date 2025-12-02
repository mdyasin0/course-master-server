const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// ----------------------
const fetch = require("node-fetch"); // একবার import হবে, আর fetch কাজ করবে

const app = express();
app.use(cors());
app.use(express.json());

// ----------------------
// MongoDB Connect
// ----------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("DB Error:", err));

// ----------------------
// COURSE SCHEMA
// ----------------------
const courseSchema = new mongoose.Schema({
  title: String,
  description: String,
  instructor: String,
  price: Number,
  category: String,
  syllabus: String,
  batch: String,
  thumbnail: String,
  lessons: [String],
});

const Course = mongoose.model("Course", courseSchema);

// ----------------------
// USER SCHEMA
// ----------------------
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "student" },
  registeredAt: { type: Date, default: Date.now },
});

const Users = mongoose.model("Users", userSchema);

// ----------------------
// REGISTER ROUTE
// ----------------------
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await Users.findOne({ email });
    if (existingUser)
      return res
        .status(400)
        .json({ success: false, message: "Email already exists!" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new Users({
      name,
      email,
      password: hashedPassword,
      role: "student",
    });

    await newUser.save();

    res
      .status(201)
      .json({ success: true, message: "User registered successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// COURSE CRUD
// ----------------------
app.post("/create-course", async (req, res) => {
  try {
    const newCourse = new Course(req.body);
    await newCourse.save();
    res
      .status(201)
      .json({
        success: true,
        message: "Course created successfully!",
        course: newCourse,
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/courses", async (req, res) => {
  try {
    const courses = await Course.find();
    res.status(200).json({ success: true, total: courses.length, courses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/course/:id", async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course)
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    res.status(200).json({ success: true, course });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/course/:id", async (req, res) => {
  try {
    const updatedCourse = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!updatedCourse)
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    res.status(200).json({ success: true, course: updatedCourse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/course/:id", async (req, res) => {
  try {
    const deletedCourse = await Course.findByIdAndDelete(req.params.id);
    if (!deletedCourse)
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    res
      .status(200)
      .json({
        success: true,
        message: "Course deleted",
        course: deletedCourse,
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const enrollmentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  courseTitle: String,
  name: String,
  email: String,
  phone: String,
  amount: Number,
  paymentMethod: String,
  transactionId: String,
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

const Enrollment = mongoose.model("Enrollment", enrollmentSchema);
app.post("/enroll/manual", async (req, res) => {
  try {
    const {
      userId,
      courseId,
      courseTitle,
      name,
      email,
      phone,
      amount,
      paymentMethod,
      transactionId,
    } = req.body;

    const enrollment = new Enrollment({
      userId,
      courseId,
      courseTitle,
      name,
      email,
      phone,
      amount,
      paymentMethod,
      transactionId,
      status: "pending",
    });

    await enrollment.save();

    res
      .status(201)
      .json({ message: "Enrollment submitted! Waiting for admin approval." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
});
// -----------
// get all enrolment data
// ---------

app.get("/enrollments", async (req, res) => {
  try {
    const enrollments = await Enrollment.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, enrollments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// --------------
// status process
// ----------------
app.put("/enrollment/approve/:id", async (req, res) => {
  try {
    const { adminTransactionId } = req.body;

    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment)
      return res.status(404).json({ message: "Enrollment not found" });

    if (enrollment.transactionId !== adminTransactionId)
      return res.status(400).json({ message: "Transaction ID mismatch" });

    enrollment.status = "approved";
    await enrollment.save();

    res.json({ message: "Enrollment approved successfully!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// -------
// block sttatus
// ---------------------------------
app.put("/enrollment/block/:id", async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment)
      return res.status(404).json({ message: "Enrollment not found" });

    enrollment.status = "blocked";
    await enrollment.save();

    res.json({ message: "Enrollment has been blocked!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// ----------------------
// Unblock Enrollment (blocked → pending)
// ----------------------
app.put("/enrollment/unblock/:id", async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment)
      return res.status(404).json({ message: "Enrollment not found" });

    // Status unblock → pending
    enrollment.status = "pending";
    await enrollment.save();

    res.json({ message: "Enrollment has been unblocked and set to pending!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ----------------------
// SERVER START
// ----------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
