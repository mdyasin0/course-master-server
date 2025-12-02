const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

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
// SIMPLE Course Schema
// ----------------------
const courseSchema = new mongoose.Schema({
  title: String,
  description: String,
  instructor: String,
  price: Number,
  category: String,
  syllabus: String,
  batch: String,
  thumbnail: String, // NEW
  lessons: [String], // NEW (video links, each = 1 lesson)
});

const Course = mongoose.model("Course", courseSchema);

// ----------------------
// POST API → Add Course
// ----------------------
app.post("/create-course", async (req, res) => {
  try {
    const newCourse = new Course(req.body);
    await newCourse.save();

    res.status(201).json({
      success: true,
      message: "Course created successfully!",
      course: newCourse,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ----------------------
// GET API → Get All Courses
// ----------------------
app.get("/courses", async (req, res) => {
  try {
    const courses = await Course.find(); // সব কোর্স আনা হচ্ছে

    res.status(200).json({
      success: true,
      total: courses.length,
      courses,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// GET API → Get Single Course by ID
// ----------------------
app.get("/course/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const course = await Course.findById(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.status(200).json({
      success: true,
      course,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a course by ID (with lessons )
app.put("/course/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body; // with lessons array 

    const updatedCourse = await Course.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!updatedCourse) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      course: updatedCourse,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Delete a course by ID
app.delete("/course/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const deletedCourse = await Course.findByIdAndDelete(id);

    if (!deletedCourse) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
      course: deletedCourse,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// Basic test route
// ----------------------
app.get("/", (req, res) => {
  res.send("Backend running...");
});

// ----------------------
// Start server
// ----------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
