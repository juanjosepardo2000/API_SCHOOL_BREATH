#!/usr/bin/env node
/**
 * One-off / ops: set Swara Yoga course progress for a user.
 * Completes all lessons except "Bonus Tools: More" (Healing + Download are completed).
 * With current Mongo course shape this is typically 40/42 lessons (~40/43 if counting differs).
 *
 * Usage:
 *   node scripts/set-user-swara-progress.js <userId>
 *
 * Requires MONGODB / dotenv same as the app (see src/configs/database).
 */
require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/configs/database');
const Course = require('../src/models/courses.model');
const CourseProgressV2 = require('../src/models/userProgress.v2.model');

const userIdArg = process.argv[2];
if (!userIdArg || !mongoose.isValidObjectId(userIdArg)) {
  console.error('Usage: node scripts/set-user-swara-progress.js <userId>');
  process.exit(1);
}

function shouldLeaveIncomplete(sectionTitle) {
  const t = String(sectionTitle || '').trim();
  if (!t) return false;
  if (t.startsWith('Bonus Tools: More')) return true;
  return false;
}

function buildSectionsProgress(course, now) {
  const sectionsProgress = [];

  for (const section of course.sections || []) {
    const sectionId = String(section._id);
    const incomplete = shouldLeaveIncomplete(section.section);
    const lessonsProgress = (section.lessons || []).map((lesson) => {
      const lessonId = String(lesson._id);
      return {
        lessonId,
        completed: !incomplete,
        lastWatched: incomplete ? null : now,
        watchTimeInSeconds: incomplete ? 0 : Math.max(1, Number(lesson.durationInSeconds) || 1),
        status: incomplete ? 'pending' : 'completed',
      };
    });
    sectionsProgress.push({ sectionId, lessonsProgress });
  }

  let totalLessons = 0;
  let completedLessons = 0;
  for (const sp of sectionsProgress) {
    for (const lp of sp.lessonsProgress) {
      totalLessons += 1;
      if (lp.completed) completedLessons += 1;
    }
  }

  const completionPercentage =
    totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
  const isCompleted =
    totalLessons > 0 && completedLessons === totalLessons;

  return {
    sectionsProgress,
    completionPercentage,
    isCompleted,
    totalLessons,
    completedLessons,
  };
}

async function main() {
  await connectDB();

  const course = await Course.findOne({ title: /swara/i }).lean();
  if (!course || !course._id) {
    console.error('Swara course not found in DB');
    process.exit(1);
  }

  const userId = new mongoose.Types.ObjectId(userIdArg);
  const now = new Date();
  const built = buildSectionsProgress(course, now);

  const result = await CourseProgressV2.findOneAndUpdate(
    { userId, courseId: course._id },
    {
      $set: {
        userId,
        courseId: course._id,
        sectionsProgress: built.sectionsProgress,
        completionPercentage: built.completionPercentage,
        isCompleted: built.isCompleted,
        lastAccessDate: now,
      },
    },
    { upsert: true, new: true }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        userId: String(userId),
        courseId: String(course._id),
        courseTitle: course.title,
        totalLessons: built.totalLessons,
        completedLessons: built.completedLessons,
        completionPercentage: built.completionPercentage,
        isCompleted: built.isCompleted,
        progressId: String(result._id),
      },
      null,
      2
    )
  );

  await closeDB();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await closeDB();
  } catch (_) {}
  process.exit(1);
});
