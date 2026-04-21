const mongoose = require('mongoose');

const lessonProgressSchema = new mongoose.Schema({
  lessonId: {
    type: String,
    required: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  lastWatched: {
    type: Date,
    default: null
  },
  watchTimeInSeconds: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending'
  }
});

const sectionProgressSchema = new mongoose.Schema({
  sectionId: {
    type: String,
    required: true
  },
  lessonsProgress: [lessonProgressSchema]
});

const courseProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  lastAccessDate: {
    type: Date,
    default: Date.now
  },
  sectionsProgress: [sectionProgressSchema],
  completionPercentage: {
    type: Number,
    default: 0
  },
  isCompleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'courseprogresses'
});

courseProgressSchema.methods.updateCompletionPercentage = function() {
  let totalLessons = 0;
  let completedLessons = 0;

  this.sectionsProgress.forEach(section => {
    totalLessons += section.lessonsProgress.length;
    completedLessons += section.lessonsProgress.filter(lesson => lesson.completed).length;
  });

  this.completionPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
  this.isCompleted = totalLessons > 0 && completedLessons === totalLessons;
};

courseProgressSchema.methods.markLessonAsCompleted = async function(sectionId, lessonId) {
  const normalizedSectionId = sectionId.toString();
  const normalizedLessonId = lessonId.toString();

  let section = this.sectionsProgress.find(s => s.sectionId.toString() === normalizedSectionId);
  if (!section) {
    section = {
      sectionId: normalizedSectionId,
      lessonsProgress: [],
    };
    this.sectionsProgress.push(section);
  }

  let lesson = section.lessonsProgress.find(l => l.lessonId.toString() === normalizedLessonId);
  if (!lesson) {
    lesson = {
      lessonId: normalizedLessonId,
      completed: false,
      lastWatched: null,
      watchTimeInSeconds: 0,
    };
    section.lessonsProgress.push(lesson);
  }

  lesson.completed = true;
  lesson.lastWatched = new Date();
  lesson.status = 'completed';
  this.lastAccessDate = new Date();
  this.updateCompletionPercentage();
  await this.save();
};

courseProgressSchema.methods.updateLessonWatchTime = async function(sectionId, lessonId, seconds) {
  const normalizedSectionId = sectionId.toString();
  const normalizedLessonId = lessonId.toString();

  let section = this.sectionsProgress.find(s => s.sectionId.toString() === normalizedSectionId);
  if (!section) {
    section = {
      sectionId: normalizedSectionId,
      lessonsProgress: [],
    };
    this.sectionsProgress.push(section);
  }

  let lesson = section.lessonsProgress.find(l => l.lessonId.toString() === normalizedLessonId);
  if (!lesson) {
    lesson = {
      lessonId: normalizedLessonId,
      completed: false,
      lastWatched: null,
      watchTimeInSeconds: 0,
    };
    section.lessonsProgress.push(lesson);
  }

  lesson.watchTimeInSeconds = seconds;
  lesson.lastWatched = new Date();
  lesson.status = lesson.completed ? 'completed' : seconds > 0 ? 'in-progress' : 'pending';
  this.lastAccessDate = new Date();
  this.updateCompletionPercentage();
  await this.save();
};

module.exports = mongoose.model('CourseProgressV2', courseProgressSchema);
