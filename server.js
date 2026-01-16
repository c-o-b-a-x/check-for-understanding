import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static("public"));
app.use(express.json());

// Store active quiz rooms
const rooms = new Map();

// Room structure:
// {
//   roomCode: string,
//   quizData: object,
//   players: Map<socketId, {name, score, answers}>,
//   currentQuestion: number,
//   started: boolean,
//   questionStartTime: timestamp
// }

// Generate random room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Shuffle array (for randomizing answer options)
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function endQuiz(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const results = Array.from(room.players.values())
    .map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      answers: player.answers,
    }))
    .sort((a, b) => b.score - a.score);

  io.to(roomCode).emit("quizResults", {
    results,
    winner: results[0],
  });

  // Send detailed report to admin only
  const detailedReports = results.map((player) => ({
    username: player.name,
    score: player.score,
    totalQuestions: room.quizData.length,
    questions: room.quizData.map((q, index) => ({
      questionNumber: index + 1,
      question: q.question,
      correctAnswer: q.choices.correct,
      playerAnswer: player.answers[index] || "No answer",
      isCorrect: player.answers[index] === q.choices.correct,
    })),
  }));

  io.to(room.adminId).emit("adminReport", detailedReports);

  console.log(`Quiz ended in room ${roomCode}`);
}
function sendQuestion(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const questionData = room.quizData[room.currentQuestion];
  if (!questionData) {
    // Call endQuiz instead of emitting directly
    endQuiz(roomCode);
    return;
  }

  const choices = questionData.choices;
  const options = [
    choices.correct,
    choices.wrong1,
    choices.wrong2,
    choices.wrong3,
  ].sort(() => Math.random() - 0.5);

  io.to(roomCode).emit("question", {
    question: questionData.question,
    options,
    questionNumber: room.currentQuestion + 1,
  });

  room.questionStartTime = Date.now();
}
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("create_room", (callback) => {
    const roomCode = generateRoomCode();

    rooms.set(roomCode, {
      roomCode,
      quizData: null,
      players: new Map(),
      currentQuestion: 0,
      started: false,
      questionStartTime: null,
      adminId: socket.id, // Track admin
    });

    socket.join(roomCode);
    socket.roomCode = roomCode;
    console.log(`Room created: ${roomCode}`);

    if (callback) callback({ roomCode });
  });
  socket.on("submit_answer", ({ roomCode, answer }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const questionData = room.quizData[room.currentQuestion];
    if (!questionData) return;

    player.answers[room.currentQuestion] = answer;

    // Check against choices.correct
    if (answer === questionData.choices.correct) {
      player.score += 1;
    }

    // Check if all players answered
    const allAnswered = Array.from(room.players.values()).every(
      (p) =>
        p.id === room.adminId || p.answers[room.currentQuestion] !== undefined,
    );

    if (allAnswered) {
      // Send results
      io.to(roomCode).emit("question_results", {
        correctAnswer: questionData.choices.correct, // Changed from right_answer
        scores: Array.from(room.players.values()).map((p) => ({
          name: p.name,
          score: p.score,
        })),
      });

      // Move to next question
      room.currentQuestion += 1;

      // Wait 2 seconds before sending next question
      setTimeout(() => sendQuestion(roomCode), 2000);
    }
  });
  socket.on("quizDataUploaded", ({ roomCode, quizData }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    room.quizData = quizData;
    room.currentQuestion = 0;

    console.log("Stored quiz:", quizData);
  });

  // Join existing room
  socket.on("join_room", ({ roomCode, username }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }
    if (room.started) {
      socket.emit("error", { message: "Quiz already started" });
      return;
    }

    socket.join(roomCode);
    socket.roomCode = roomCode;

    // Don't add admin as a player
    if (socket.id !== room.adminId) {
      room.players.set(socket.id, {
        id: socket.id,
        name: username || `Player ${room.players.size + 1}`,
        score: 0,
        answers: [],
      });
    }

    socket.emit("room_joined", roomCode);
    io.to(roomCode).emit("player_joined", {
      playerId: socket.id,
      playerCount: room.players.size,
      players: Array.from(room.players.values()),
    });
  });

  // Handle quiz creation
  socket.on("quizDataCreated", (quizData) => {
    const roomCode = socket.roomCode;
    const room = rooms.get(roomCode);

    if (room) {
      room.quizData = quizData;
      console.log(`Quiz created in room ${roomCode}`);
      io.to(roomCode).emit("quiz_ready", {
        message: "Quiz created and ready!",
      });
    }
  });

  // Start quiz
  socket.on("start_quiz", (roomCode) => {
    console.log("start_quiz received with:", roomCode);

    const room = rooms.get(roomCode);
    if (!room) {
      console.log("❌ No room found");
      return;
    }

    if (!room.quizData) {
      console.log("❌ No quizData in room");
      return;
    }

    if (room.quizData.length === 0) {
      console.log("❌ quizData is empty");
      return;
    }

    if (room.started) {
      console.log("❌ quiz already started");
      return;
    }

    console.log("✅ All checks passed, starting quiz");

    room.started = true;
    room.currentQuestion = 0;

    io.to(roomCode).emit("quizStarted", {
      totalQuestions: room.quizData.length,
    });

    sendQuestion(roomCode);
  });

  // Send question to all players in room

  // Next question

  // End quiz and send results

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    const roomCode = socket.roomCode;
    if (roomCode) {
      const room = rooms.get(roomCode);
      if (room) {
        room.players.delete(socket.id);

        // Notify remaining players
        io.to(roomCode).emit("player_left", {
          playerId: socket.id,
          playerCount: room.players.size,
        });

        // Delete room if empty
        if (room.players.size === 0) {
          rooms.delete(roomCode);
          console.log(`Room ${roomCode} deleted (empty)`);
        }
      }
    }
  });
});

// Routes
app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "public", "index.html"));
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
