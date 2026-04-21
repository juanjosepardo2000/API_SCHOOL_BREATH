const CoursesController = require("../controllers/upload_courses.controller");
const courseProgressController = require("../controllers/course_progress_v2.controller");
const courseProgressControllerUser = require("../controllers/course_progress_user_v2.controller");
const learningController = require("../controllers/learning_v2.controller");
const { Router } = require("express");
const { authorize } = require("../utils/auth");

const router = Router();

/**
 * V2 course/progress endpoints.
 * Mirrors /courses behavior without changing existing /courses routes.
 */
router.route("/user").get(courseProgressControllerUser.getCourses);

router.get("/course/:courseId/sections", courseProgressControllerUser.getCourseSectionsAndLessons);

router.route("/usersystemeio").get(CoursesController.getSystemeIoCourses);
router.route("/create").post(CoursesController.createCourse);
router.route("/update").put(CoursesController.updateCourse);
router.route("/course/:id").get(CoursesController.getCourseById);
router.route("/scratch").get(CoursesController.getScratchCourses);
router.route("/scratch/:id").delete(CoursesController.deleteScratchCourse);
router.route("/delete/:id").delete(CoursesController.deleteCourse);
router.put("/order", CoursesController.updateCourseOrder);

router.post(
  "/:courseId/sections/:sectionId/lessons/:lessonId/complete",
  authorize(),
  courseProgressController.markLessonAsCompleted
);

router.patch(
  "/:courseId/sections/:sectionId/lessons/:lessonId/progress",
  authorize(),
  courseProgressController.updateLessonProgress
);

router.patch(
  "/:courseId/sections/:sectionId/lessons/:lessonId/duration",
  authorize(),
  courseProgressController.updateLessonDuration
);

router.get(
  "/:courseId/sections/:sectionId/lessons/:lessonId/progress",
  authorize(),
  courseProgressControllerUser.getLessonProgress
);

router.get("/my-progress", authorize(), courseProgressController.getCourseStatistics);
router.get("/resume-learning", authorize(), learningController.getResumeLearning);

module.exports = router;

