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

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new room
  socket.on("create_room", (callback) => {
    const roomCode = generateRoomCode();

    rooms.set(roomCode, {
      roomCode,
      quizData: null,
      players: new Map(),
      currentQuestion: 0,
      started: false,
      questionStartTime: null,
    });

    socket.join(roomCode);
    console.log(`Room created: ${roomCode}`);

    if (callback) callback({ roomCode });
  });

  // Join existing room
  socket.on("join_room", (roomCode) => {
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

    // Add player to room
    room.players.set(socket.id, {
      id: socket.id,
      name: `Player ${room.players.size + 1}`,
      score: 0,
      answers: [],
    });

    console.log(`${socket.id} joined room: ${roomCode}`);
    socket.emit("room_joined", roomCode);

    // Notify all players in room
    io.to(roomCode).emit("player_joined", {
      playerId: socket.id,
      playerCount: room.players.size,
      players: Array.from(room.players.values()),
    });
  });

  // Upload quiz data to room
  socket.on("quizDataUploaded", (quizData) => {
    const roomCode = socket.roomCode;
    const room = rooms.get(roomCode);

    if (room) {
      room.quizData = quizData;
      console.log(`Quiz data uploaded to room ${roomCode}`);
      io.to(roomCode).emit("quiz_ready", { message: "Quiz loaded and ready!" });
    }
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
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }

    if (
      !room.quizData ||
      !room.quizData.questions ||
      room.quizData.questions.length === 0
    ) {
      socket.emit("error", { message: "No quiz data available" });
      return;
    }

    if (room.started) {
      socket.emit("error", { message: "Quiz already started" });
      return;
    }

    room.started = true;
    room.currentQuestion = 0;

    console.log(`Quiz started in room ${roomCode}`);
    io.to(roomCode).emit("quizStarted", {
      totalQuestions: room.quizData.questions.length,
      timePerQuestion: room.quizData.timePerQuestion || 30,
    });

    // Send first question
    sendQuestion(roomCode);
  });

  // Send question to all players in room
  function sendQuestion(roomCode) {
    const room = rooms.get(roomCode);
    if (!room || !room.quizData) return;

    const question = room.quizData.questions[room.currentQuestion];
    if (!question) {
      endQuiz(roomCode);
      return;
    }

    // Shuffle options and track correct answer
    const shuffledOptions = shuffleArray(question.options);
    const correctAnswerIndex = shuffledOptions.indexOf(
      question.options[question.correctAnswer]
    );

    room.questionStartTime = Date.now();

    // Send question without revealing correct answer
    io.to(roomCode).emit("nextQuestion", {
      questionNumber: room.currentQuestion + 1,
      totalQuestions: room.quizData.questions.length,
      question: question.question,
      options: shuffledOptions,
      points: question.points || 10,
      timeLimit: room.quizData.timePerQuestion || 30,
    });

    // Store correct answer index temporarily
    room.correctAnswerIndex = correctAnswerIndex;
  }

  // Submit answer
  socket.on("submitAnswer", (data) => {
    const roomCode = socket.roomCode;
    const room = rooms.get(roomCode);

    if (!room || !room.started) {
      socket.emit("error", { message: "Invalid quiz session" });
      return;
    }

    const player = room.players.get(socket.id);
    if (!player) {
      socket.emit("error", { message: "Player not found" });
      return;
    }

    const { answerIndex, timestamp } = data;
    const timeElapsed = (timestamp - room.questionStartTime) / 1000;
    const isCorrect = answerIndex === room.correctAnswerIndex;

    // Calculate points (bonus for speed)
    let points = 0;
    if (isCorrect) {
      const question = room.quizData.questions[room.currentQuestion];
      const basePoints = question.points || 10;
      const timeBonus = Math.max(0, Math.floor((30 - timeElapsed) / 3));
      points = basePoints + timeBonus;
      player.score += points;
    }

    player.answers.push({
      questionIndex: room.currentQuestion,
      answer: answerIndex,
      correct: isCorrect,
      points,
      timeElapsed,
    });

    // Notify player of result
    socket.emit("answerResult", {
      correct: isCorrect,
      points,
      correctAnswer: room.correctAnswerIndex,
      newScore: player.score,
    });

    // Notify room that player answered
    io.to(roomCode).emit("playerAnswered", {
      playerId: socket.id,
      playerName: player.name,
    });

    console.log(
      `${socket.id} answered question ${room.currentQuestion + 1}: ${
        isCorrect ? "correct" : "incorrect"
      }`
    );
  });

  // Next question
  socket.on("nextQuestion", (roomCode) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    room.currentQuestion++;

    if (room.currentQuestion < room.quizData.questions.length) {
      sendQuestion(roomCode);
    } else {
      endQuiz(roomCode);
    }
  });

  // End quiz and send results
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

    // Send user data for leaderboard
    io.to(roomCode).emit(
      "userdata",
      results.map((r) => ({
        username: r.name,
        score: r.score,
      }))
    );

    console.log(`Quiz ended in room ${roomCode}`);
  }

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

app.get("/example.json", (req, res) => {
  const exampleQuiz = {
    quizId: "example-001",
    title: "Example Quiz",
    description: "Sample quiz data",
    timePerQuestion: 30,
    questions: [
      {
        id: "q1",
        question: "What is 2 + 2?",
        options: ["3", "4", "5", "6"],
        correctAnswer: 1,
        points: 10,
        category: "Math",
      },
      {
        id: "q2",
        question: "What color is the sky?",
        options: ["Red", "Blue", "Green", "Yellow"],
        correctAnswer: 1,
        points: 10,
        category: "Science",
      },
    ],
  };
  res.json(exampleQuiz);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
