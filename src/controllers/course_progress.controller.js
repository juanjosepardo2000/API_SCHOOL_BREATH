const Course = require('../models/courses.model');
const CourseProgress = require('../models/userProgress.model');
const { UserModel } = require("../models/user.model");
const axios = require('axios');


exports.getCourseProgress = async (req, res, next) => {
    const { courseId } = req.params;
    const userId = req.user._id;
  
    let progress = await CourseProgress.findOne({ courseId, userId });
  
    if (!progress) {
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          status: "error",
          message: "Course not found"
        })
      }
  
      progress = await CourseProgress.create({
        userId,
        courseId,
        sectionsProgress: course.sections.map((section) => ({
          sectionId: section._id,
          lessonsProgress: section.lessons.map((lesson) => ({
            lessonId: lesson._id,
            completed: false,
          })),
        })),
      });
    }
  
    res.status(200).json({
      status: "success",
      data: {
        progress,
      },
    });
  };
  
  
  exports.markLessonAsCompleted = async (req, res, next) => {
    const { courseId, sectionId, lessonId } = req.params;
    const userId = req.user._id;
  
  
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ 
        status: "error",
        message: "Course not found" 
      });
    }
  
  
    let progress = await CourseProgress.findOne({ courseId, userId });
  
    
    if (!progress) {
  
      const initialSectionsProgress = course.sections.map(section => ({
        sectionId: section._id.toString(),
        lessonsProgress: section.lessons.map(lesson => ({
          lessonId: lesson._id.toString(),
          completed: false,
          watchTimeInSeconds: 0,
          lastWatched: null,
          status: 'pending' // pending, in-progress, completed
        }))
      }));
  
      progress = await CourseProgress.create({
        userId,
        courseId,
        startDate: new Date(),
        lastAccessDate: new Date(),
        completionPercentage: 0,
        isCompleted: false,
        sectionsProgress: initialSectionsProgress
      });
    }
  
    let sectionProgress = progress.sectionsProgress.find(
      s => s.sectionId.toString() === sectionId
    );
  
    if (!sectionProgress) {
      const courseSection = course.sections.find(s => s._id.toString() === sectionId);
      if (courseSection) {
        const newSectionProgress = {
          sectionId: sectionId,
          lessonsProgress: courseSection.lessons.map(lesson => ({
            lessonId: lesson._id.toString(),
            completed: false,
            watchTimeInSeconds: 0,
            lastWatched: null,
            status: 'pending'
          }))
        };
        progress.sectionsProgress.push(newSectionProgress);
        sectionProgress = newSectionProgress;
      }
    }
  
  
    let lessonProgress = sectionProgress?.lessonsProgress.find(
      l => l.lessonId.toString() === lessonId
    );
  
    if (!lessonProgress && sectionProgress) {
      const courseSection = course.sections.find(s => s._id.toString() === sectionId);
      const courseLesson = courseSection?.lessons.find(l => l._id.toString() === lessonId);
      
      if (courseLesson) {
        lessonProgress = {
          lessonId: lessonId,
          completed: false,
          watchTimeInSeconds: 0,
          lastWatched: null,
          status: 'pending'
        };
        sectionProgress.lessonsProgress.push(lessonProgress);
      }
    }
  
    // 8. Marcar la lección como completada
    if (lessonProgress) {
      lessonProgress.completed = true;
      lessonProgress.lastWatched = new Date();
      lessonProgress.status = 'completed';
      await progress.updateCompletionPercentage();
      await progress.save();
    }
  
    res.status(200).json({
      status: "success",
      data: {
        progress
      }
    });
  }
  
  
  exports.getCourseProgress = async (req, res, next) => {
    const { courseId } = req.params;
    const userId = req.user._id;
  
    
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        status: "error",
        message: "Course not found"
      });
    }
  
  
    let progress = await CourseProgress.findOne({ courseId, userId });
  
    
    if (!progress) {
      const initialSectionsProgress = course.sections.map(section => ({
        sectionId: section._id.toString(),
        lessonsProgress: section.lessons.map(lesson => ({
          lessonId: lesson._id.toString(),
          completed: false,
          watchTimeInSeconds: 0,
          lastWatched: null,
          status: 'pending'
        }))
      }));
  
      progress = await CourseProgress.create({
        userId,
        courseId,
        startDate: new Date(),
        lastAccessDate: new Date(),
        completionPercentage: 0,
        isCompleted: false,
        sectionsProgress: initialSectionsProgress
      });
    }
  
    res.status(200).json({
      status: "success",
      data: {
        progress
      }
    });
  }
  exports.updateLessonProgress = async (req, res, next) => {
    const { courseId, sectionId, lessonId } = req.params;
    const { watchTimeInSeconds } = req.body;
    const userId = req.user._id;

    let progress = await CourseProgress.findOne({ courseId, userId });

    if (!progress) {
        // Create initial progress record
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ 
                status: "error",
                message: "Course not found" 
            });
        }

        const initialSectionsProgress = course.sections.map(section => ({
            sectionId: section._id.toString(),
            lessonsProgress: section.lessons.map(lesson => ({
                lessonId: lesson._id.toString(),
                completed: false,
                watchTimeInSeconds: 0,
                lastWatched: null,
                status: 'pending'
            }))
        }));

        progress = await CourseProgress.create({
            userId,
            courseId,
            startDate: new Date(),
            lastAccessDate: new Date(),
            completionPercentage: 0,
            isCompleted: false,
            sectionsProgress: initialSectionsProgress
        });
    }

    await progress.updateLessonWatchTime(sectionId, lessonId, watchTimeInSeconds);

    res.status(200).json({
        status: "success",
        data: {
            progress,
        },
    });
};
  
  

  

exports.getCourseStatistics = async (req, res) => {
  try {
      const userEmail = req.user.email;
      const user = await UserModel.findOne({ email: userEmail });
      if (!user) {
          return res.status(404).json({ message: "User not found" });
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

      const courses = await Course.find().sort({ order: 1, createdAt: -1 });

      const accessibleCourses = courses.filter((course) =>
          course.accessTags.some((tag) => userTags.includes(tag))
      );

      const progresses = await CourseProgress.find({ userId: user._id });

      const progressMap = progresses.reduce((acc, progress) => {
          acc[progress.courseId] = progress;
          return acc;
      }, {});

      let completedCourses = 0;
      let inProgressCourses = 0;

      const courseProgress = accessibleCourses.map((course) => {
          const progressData = progressMap[course._id];
          if (progressData) {
              if (progressData.isCompleted) {
                  completedCourses++;
              } else {
                  inProgressCourses++;
              }

              // Calculate section and lesson completion
              let completedSections = 0;
              let totalSections = course.sections.length;
              let completedLessons = 0;
              let totalLessons = 0;

              course.sections.forEach(section => {
                  const sectionProgress = progressData.sectionsProgress.find(
                      sp => sp.sectionId.toString() === section._id.toString()
                  );

                  totalLessons += section.lessons.length;

                  if (sectionProgress) {
                      const allLessonsCompleted = sectionProgress.lessonsProgress.every(
                          lesson => lesson.completed
                      );
                      if (allLessonsCompleted) {
                          completedSections++;
                      }
                      completedLessons += sectionProgress.lessonsProgress.filter(
                          lesson => lesson.completed
                      ).length;
                  }
              });

              return {
                  courseId: course._id,
                  title: course.title,
                  completionPercentage: progressData.completionPercentage || 0,
                  isCompleted: progressData.isCompleted,
                  lastAccessDate: progressData.lastAccessDate,
                  completedSections,
                  totalSections,
                  completedLessons,
                  totalLessons
              };
          }

          return {
              courseId: course._id,
              title: course.title,
              completionPercentage: 0,
              isCompleted: false,
              lastAccessDate: null,
              completedSections: 0,
              totalSections: course.sections.length,
              completedLessons: 0,
              totalLessons: course.sections.reduce((acc, section) => acc + section.lessons.length, 0)
          };
      });

      const totalCourses = accessibleCourses.length;
      const completedPercentage = totalCourses > 0 ? (completedCourses / totalCourses) * 100 : 0;
    

      return res.status(200).json({
          totalCourses,
          completedCourses,
          inProgressCourses,
          completedPercentage,
          courseProgress
      });
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
};


exports.getResumeLearning = async (req, res) => {
  try {
    const userId = req.user._id;
    const userEmail = req.user.email;

    // Get all user progress records sorted by lastAccessDate
    const allProgress = await CourseProgress.find({ userId })
      .sort({ lastAccessDate: -1 })
      .lean();

    if (!allProgress || allProgress.length === 0) {
      return res.status(200).json({
        status: "success",
        data: null
      });
    }

    // Get user tags for access control
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
    const fullAccessTags = ["Enrolled_Holistic Membership"];
    const hasFullAccess = userTags.some(tag => fullAccessTags.includes(tag));

    // PRIORITY 1: Find incomplete lessons with watch time > 0
    for (const progress of allProgress) {
      const course = await Course.findById(progress.courseId);
      if (!course) continue;

      // Check user has access to this course
      const hasSpecificAccess = course.accessTags.some(tag => userTags.includes(tag));
      if (!hasFullAccess && !hasSpecificAccess) continue;

      // Find first incomplete lesson with watch progress
      for (const sectionProgress of progress.sectionsProgress) {
        const courseSection = course.sections.find(
          s => s._id.toString() === sectionProgress.sectionId.toString()
        );
        if (!courseSection) continue;

        for (const lessonProgress of sectionProgress.lessonsProgress) {
          const courseLesson = courseSection.lessons.find(
            l => l._id.toString() === lessonProgress.lessonId.toString()
          );
          if (!courseLesson) continue;

          // Priority: Incomplete lessons with watch time > 0
          if (!lessonProgress.completed &&
              lessonProgress.watchTimeInSeconds > 0 &&
              lessonProgress.lastWatched) {

            const resumeData = {
              courseId: course._id.toString(),
              courseTitle: course.title,
              sectionId: courseSection._id.toString(),
              lessonId: courseLesson._id.toString(),
              lessonTitle: courseLesson.title,
              videoUrl: courseLesson.videoUrl || "",
              fromYoutube: courseLesson.isFromYoutube || false,
              completed: lessonProgress.completed,
              watchTimeInSeconds: lessonProgress.watchTimeInSeconds || 0,
              duration: courseLesson.durationInSeconds || 0,
              lastWatched: lessonProgress.lastWatched,
              progress: progress.completionPercentage || 0
            };

            return res.status(200).json({
              status: "success",
              data: resumeData
            });
          }
        }
      }
    }

    // PRIORITY 2: No in-progress lessons found, show next incomplete lesson in most recent course
    for (const progress of allProgress) {
      const course = await Course.findById(progress.courseId);
      if (!course) continue;

      // Check user has access to this course
      const hasSpecificAccess = course.accessTags.some(tag => userTags.includes(tag));
      if (!hasFullAccess && !hasSpecificAccess) continue;

      // Find FIRST incomplete lesson (even with 0 watch time)
      for (const sectionProgress of progress.sectionsProgress) {
        const courseSection = course.sections.find(
          s => s._id.toString() === sectionProgress.sectionId.toString()
        );
        if (!courseSection) continue;

        for (const lessonProgress of sectionProgress.lessonsProgress) {
          const courseLesson = courseSection.lessons.find(
            l => l._id.toString() === lessonProgress.lessonId.toString()
          );
          if (!courseLesson) continue;

          // Any incomplete lesson
          if (!lessonProgress.completed) {
            const resumeData = {
              courseId: course._id.toString(),
              courseTitle: course.title,
              sectionId: courseSection._id.toString(),
              lessonId: courseLesson._id.toString(),
              lessonTitle: courseLesson.title,
              videoUrl: courseLesson.videoUrl || "",
              fromYoutube: courseLesson.isFromYoutube || false,
              completed: false,
              watchTimeInSeconds: lessonProgress.watchTimeInSeconds || 0,
              duration: courseLesson.durationInSeconds || 0,
              lastWatched: lessonProgress.lastWatched || new Date(),
              progress: progress.completionPercentage || 0
            };

            return res.status(200).json({
              status: "success",
              data: resumeData
            });
          }
        }
      }
    }

    // PRIORITY 3: All active courses complete, suggest first lesson from next available course
    const allCourses = await Course.find().sort({ order: 1, createdAt: 1 });

    for (const course of allCourses) {
      // Check user has access to this course
      const hasSpecificAccess = course.accessTags.some(tag => userTags.includes(tag));
      if (!hasFullAccess && !hasSpecificAccess) continue;

      // Check if user has never started this course
      const hasProgress = allProgress.find(p => p.courseId.toString() === course._id.toString());
      if (hasProgress) continue; // Skip courses already started

      // Found an untouched course - return its first lesson
      if (course.sections && course.sections.length > 0) {
        const firstSection = course.sections[0];
        if (firstSection.lessons && firstSection.lessons.length > 0) {
          const firstLesson = firstSection.lessons[0];

          const resumeData = {
            courseId: course._id.toString(),
            courseTitle: course.title,
            sectionId: firstSection._id.toString(),
            lessonId: firstLesson._id.toString(),
            lessonTitle: firstLesson.title,
            videoUrl: firstLesson.videoUrl || "",
            fromYoutube: firstLesson.isFromYoutube || false,
            completed: false,
            watchTimeInSeconds: 0,
            duration: firstLesson.durationInSeconds || 0,
            lastWatched: new Date(),
            progress: 0
          };

          return res.status(200).json({
            status: "success",
            data: resumeData
          });
        }
      }
    }

    // No courses available at all
    return res.status(200).json({
      status: "success",
      data: null
    });

  } catch (error) {
    console.error('getResumeLearning error:', error);
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
};


exports.updateLessonDuration = async (req, res) => {
  try {
    const { courseId, sectionId, lessonId } = req.params;
    const { durationInSeconds } = req.body;

    // Validate duration
    if (typeof durationInSeconds !== 'number' || durationInSeconds < 0) {
      return res.status(400).json({
        status: "error",
        message: "Invalid duration value"
      });
    }

    // Find course and update lesson duration
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        status: "error",
        message: "Course not found"
      });
    }

    const section = course.sections.find(s => s._id.toString() === sectionId);
    if (!section) {
      return res.status(404).json({
        status: "error",
        message: "Section not found"
      });
    }

    const lesson = section.lessons.find(l => l._id.toString() === lessonId);
    if (!lesson) {
      return res.status(404).json({
        status: "error",
        message: "Lesson not found"
      });
    }

    // Update duration (only if current duration is 0 to avoid overwriting valid data)
    if (lesson.durationInSeconds === 0 || lesson.durationInSeconds === undefined) {
      lesson.durationInSeconds = Math.floor(durationInSeconds);
      await course.save();

      return res.status(200).json({
        status: "success",
        message: "Duration updated successfully",
        data: { durationInSeconds: lesson.durationInSeconds }
      });
    } else {
      return res.status(200).json({
        status: "success",
        message: "Duration already set",
        data: { durationInSeconds: lesson.durationInSeconds }
      });
    }
  } catch (error) {
    console.error('updateLessonDuration error:', error);
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
};
