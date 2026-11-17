// API shapes, ported from Instructor_Evaluation lib/types.ts (field names unchanged, so existing
// clients keep working).

export type InstructorRole = 'admin' | 'instructor';
export type InstructorMatchStatus = 'matched' | 'ambiguous' | 'unmatched';

export interface Student {
  id: string;
  name: string;
  degree: string;
  section: string;
  level: string;
  currentStep?: string;
  currentTopic?: string;
  currentSubtopic?: string | null; // null when the topic has no subtopics
  hall: string;
  instructor: string;            // Student List display: instructor FIRST NAME only (raw value when not matched)
  interactionCount: number;
  levelInteractionCount?: number; // interactions logged at the student's current level
  status: string;                 // standing at the current level: Pending Evaluation | In Progress | Needs Revisit | Cleared
  lastInteractionDate?: string | null;
  instructorEmail?: string;      // matched instructor's company email (the join key)
  instructorId?: string;         // matched instructor's directory id, e.g. INS010
  instructorFullName?: string;   // matched instructor's full name, for the Instructor List and snapshots
  instructorMatch?: InstructorMatchStatus;
}

// One student who crossed a level boundary upward and is still above it, dated by the day they completed the level;
// see getLevelConversions in db/queries.ts.
export interface LevelConversion {
  date: string;       // YYYY-MM-DD
  studentId: string;
  fromLevel: string;  // e.g. "Level 0"
  toLevel: string;    // e.g. "Level 1"
  estimated: boolean; // the level change was rebuilt from interaction history (made before tracking existed)
  incomplete: boolean; // promoted before every required topic of the old level was cleared in the logs
}

export interface InteractionLog {
  id: string;
  studentId: string;
  studentName: string;
  instructorName: string;
  assignedInstructorName?: string;
  instructorEmail?: string;
  takenByInstructorId?: string | null; // directory id of "interaction taken by", resolved on the server
  topics: string;
  statusPostInteraction: 'Need to Revisit' | 'Cleared' | 'In Progress' | string;
  rating: number;
  questionsAsked: string;
  remarks: string;
  performedWell: string;
  improvementAreas: string;
  tweakedQuestions: string;
  actionItems: string;
  meetRecording: string;
  granolaTranscript: string;
  interactionRound: number;
  level?: string;        // student's level when the interaction was logged
  currentStep?: string;  // student's step when the interaction was logged
  currentSubtopic?: string | null; // student's subtopic when the interaction was logged
  subtopics?: string;              // subtopics covered, comma-joined; set only when the topic has subtopics
  stepsReached?: Record<string, string>; // step code reached per subtopic (or topic) covered, e.g. { "LCM & GCD": "3.1" }
  date: string;
  createdAt: string;
  createdBy?: string | null;  // user id of whoever logged it
  updatedAt?: string | null;  // set when the interaction has been edited
}

// Entry in the "Interaction Taken By" dropdown.
export interface InstructorOption {
  id: string;
  name: string;      // full name
  firstName: string; // name shown in the Student List, e.g. "Gaurav-26"
}

// Admin "Add instructor" form.
export interface NewInstructorInput {
  name: string;         // full name
  firstName: string;    // name shown in the Student List (must be unique)
  email: string;        // company email, also the login
  password: string;
  studentIds: string[]; // roll numbers to assign (moved from their current instructor)
}

// Result of adding an instructor or assigning students to one.
export interface CreateInstructorResult {
  instructor: InstructorOption & { email: string };
  assigned: Array<{ id: string; name: string; previousInstructor: string | null; previousInstructorId?: string | null }>;
  alreadyAssigned?: number; // assigning only: listed students who already belonged to this instructor
}

// One "Add instructor" or "Assign students" action, for the admin Change history.
export interface InstructorChange {
  id: string;
  action: 'add_instructor' | 'assign_students';
  actorId: string;
  actorName: string;
  actorRole: 'admin' | 'senior';
  instructorId: string;   // instructor added, or who received the students
  instructorName: string;
  students: Array<{ id: string; name: string; fromId: string | null; fromName: string | null }>;
  createdAt: string;      // ISO timestamp
}

// API shape: Instructor List entry, using the instructor's full name.
export interface InstructorListEntry {
  id: string;
  firstName: string;
  name: string;          // full name
  email: string;
  students: Array<Pick<Student, 'id' | 'name' | 'level' | 'currentTopic' | 'currentSubtopic' | 'currentStep' | 'lastInteractionDate'>>;
}

// Who is making the request: the web app's signed-in user, mapped to this module's users table
// (src/auth.ts). Same shape as the original InstructorUser.
export interface Actor {
  id: string;
  name: string;
  email: string;
  role: InstructorRole;
  instructorId: string | null; // directory id for instructors; null for admins
  isSenior?: boolean;          // senior instructor: also opens the Instructors page, adds instructors and assigns students
}
