const CourseProgress = require('../models/userProgress.v2.model');
const axios = require("axios");
const Course = require("../models/courses.model");
const { UserModel } = require("../models/user.model");
const {
  calculateCourseCompletion,
  hasProgressDrift,
} = require('./course_progress_v2.helpers');

const fullAccessTags = ["Enrolled_Holistic Membership"];

exports.getLessonProgress = async (req, res) => {
  try {
    const { courseId, sectionId, lessonId } = req.params;
    const userId = req.user._id;

    const progress = await CourseProgress.findOne({ courseId, userId });
    if (!progress) {
      return res.status(200).json({
        status: "success",
        data: {
          watchTimeInSeconds: 0,
          completed: false,
          lastWatched: null
        }
      });
    }

    const sectionProgress = progress.sectionsProgress.find(
      section => section.sectionId.toString() === sectionId
    );
    const lessonProgress = sectionProgress?.lessonsProgress.find(
      lesson => lesson.lessonId.toString() === lessonId
    );

    if (!lessonProgress) {
      return res.status(200).json({
        status: "success",
        data: {
          watchTimeInSeconds: 0,
          completed: false,
          lastWatched: null
        }
      });
    }

    return res.status(200).json({
      status: "success",
      data: {
        watchTimeInSeconds: lessonProgress.watchTimeInSeconds,
        completed: lessonProgress.completed,
        lastWatched: lessonProgress.lastWatched,
        status: lessonProgress.status
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
};

exports.getCourseSectionsAndLessons = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userEmail = req.query.email;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (!userEmail) {
      const sectionsWithLimitedAccess = course.sections
        .map((section) => {
          const sectionData = section.toObject();
          if (section.isPremium) {
            sectionData.lessons = section.lessons.filter(
              (lesson) => !lesson.isPremium
            );
          }
          sectionData.lessons.forEach(lesson => lesson.completed = false);
          sectionData.isCompleted = false;
          return sectionData;
        })
        .filter((section) => section.lessons.length > 0);

      return res.status(200).json({
        sections: sectionsWithLimitedAccess,
        hasAccess: false
      });
    }

    const response = await axios.get(
      `https://api.systeme.io/api/contacts?email=${userEmail}`,
      {
        headers: {
          "x-api-key": process.env.API_SYSTEME_KEY,
        },
      }
    );

    const contacts = response.data?.items[0] ?? null;
    const userTags = contacts ? contacts.tags.map((tag) => tag.name) : [];

    const hasFullAccess = userTags.some((tag) => fullAccessTags.includes(tag));
    const hasSpecificAccess =
      Array.isArray(course.accessTags) && course.accessTags.some((tag) => userTags.includes(tag));

    const user = await UserModel.findOne({ email: userEmail });
    const progressData = user
      ? await CourseProgress.findOne({ userId: user._id, courseId: course._id })
      : null;

    const sectionsWithProgress = course.sections.map((section) => {
      const sectionData = section.toObject();
      let allLessonsCompleted = true;

      sectionData.lessons.forEach((lesson) => {
        if (progressData) {
          const sectionProgress = progressData.sectionsProgress.find(
            (sp) => sp.sectionId.toString() === section._id.toString()
          );
          if (sectionProgress) {
            const lessonProgress = sectionProgress.lessonsProgress.find(
              (lp) => lp.lessonId.toString() === lesson._id.toString()
            );
            lesson.completed = lessonProgress ? lessonProgress.completed : false;
            if (!lesson.completed) allLessonsCompleted = false;
          } else {
            lesson.completed = false;
            allLessonsCompleted = false;
          }
        } else {
          lesson.completed = false;
          allLessonsCompleted = false;
        }
      });

      sectionData.isCompleted = allLessonsCompleted;
      return sectionData;
    });

    if (!hasFullAccess && !hasSpecificAccess) {
      const filteredSections = sectionsWithProgress
        .map((section) => {
          if (section.isPremium) {
            section.lessons = section.lessons.filter(
              (lesson) => !lesson.isPremium
            );
          }
          return section;
        })
        .filter((section) => section.lessons.length > 0);

      return res.status(200).json({
        sections: filteredSections,
        hasAccess: false
      });
    }

    return res.status(200).json({
      sections: sectionsWithProgress,
      hasAccess: true
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getCourses = async (req, res) => {
  try {
    const userEmail = req.query.email;
    const courses = await Course.find().sort({ order: 1, createdAt: -1 });

    if (!userEmail) {
      const coursesWithLimitedAccess = courses.map((course) => {
        const processedCourse = course.toObject();
        processedCourse.sections = [];
        return {
          ...processedCourse,
          hasAccess: false,
          progress: 0,
        };
      });

      return res.status(200).json({
        courses: coursesWithLimitedAccess,
      });
    }

    const response = await axios.get(
      `https://api.systeme.io/api/contacts?email=${userEmail}`,
      {
        headers: {
          "x-api-key": process.env.API_SYSTEME_KEY,
        },
      }
    );

    const contacts = response.data?.items[0] ?? null;
    const userTags = contacts ? contacts.tags.map((tag) => tag.name) : [];

    const user = await UserModel.findOne({ email: userEmail });
    const userProgresses = user ? await CourseProgress.find({ userId: user._id }) : [];
    const progressDriftFixes = [];

    const progressMap = userProgresses.reduce((acc, progress) => {
      acc[String(progress.courseId)] = progress;
      return acc;
    }, {});

    const coursesWithAccess = courses.map((course) => {
      const hasFullAccess = userTags.some((tag) => fullAccessTags.includes(tag));
      const hasSpecificAccess =
        Array.isArray(course.accessTags) && course.accessTags.some((tag) => userTags.includes(tag));
      const courseObj = course.toObject();
      courseObj.sections = [];

      const progressData = progressMap[String(course._id)];
      const computedProgress = calculateCourseCompletion(course, progressData);

      if (hasProgressDrift(progressData, computedProgress)) {
        progressDriftFixes.push({
          updateOne: {
            filter: { _id: progressData._id },
            update: {
              $set: {
                completionPercentage: computedProgress.completionPercentage,
                isCompleted: computedProgress.isCompleted,
              },
            },
          },
        });
      }

      return {
        ...courseObj,
        hasAccess: hasFullAccess || hasSpecificAccess,
        progress: computedProgress.completionPercentage,
      };
    });

    if (progressDriftFixes.length > 0) {
      await CourseProgress.bulkWrite(progressDriftFixes);
    }

    return res.status(200).json({ courses: coursesWithAccess });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
