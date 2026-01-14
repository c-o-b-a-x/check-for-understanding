// Global quiz data variable with proper scope
let quizData = null;
let socket = null;

// Initialize Socket.IO after DOM loads
document.addEventListener("DOMContentLoaded", () => {
  // Check if io is available
  if (typeof io !== "undefined") {
    socket = io();

    socket.on("connect", () => {
      console.log("Connected to server with ID:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from server");
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    socket.on("userdata", (user_data) => {
      console.log("Received user data:", user_data);
      const userList = document.getElementById("userList");
      if (userList) {
        userList.innerHTML = ""; // Clear existing list

        user_data.forEach((user) => {
          const li = document.createElement("li");
          li.textContent = `Username: ${user.username}, Score: ${user.score}`;
          userList.appendChild(li);
        });
      }
    });

    // Quiz-specific socket events
    socket.on("quizStarted", (data) => {
      console.log("Quiz started:", data);
    });

    socket.on("nextQuestion", (questionData) => {
      console.log("Next question:", questionData);
      displayQuestion(questionData);
    });

    socket.on("quizResults", (results) => {
      console.log("Quiz results:", results);
      displayResults(results);
    });

    socket.on("playerAnswered", (data) => {
      console.log("Player answered:", data);
    });

    socket.on("answerResult", (data) => {
      console.log("Answer result:", data);
      showAnswerFeedback(data);
    });

    socket.on("quiz_ready", (data) => {
      console.log("Quiz ready:", data.message);
      alert(data.message);
    });

    socket.on("player_joined", (data) => {
      console.log("Player joined:", data);
    });

    socket.on("room_joined", (roomCode) => {
      console.log(`Joined room: ${roomCode}`);
      alert(`Successfully joined room: ${roomCode}`);
    });
  } else {
    console.error(
      "Socket.IO client library not loaded. Add <script src='/socket.io/socket.io.js'></script> to your HTML"
    );
  }
});

// Handle JSON file upload and display its content
const fileInput = document.getElementById("fileInput");
if (fileInput) {
  fileInput.addEventListener("change", handleFileSelect);
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      quizData = JSON.parse(reader.result);
      console.log("Loaded quiz data:", quizData);

      const output = document.getElementById("output");
      if (output) {
        output.textContent = JSON.stringify(quizData, null, 2);
      }

      // Send quiz data to server via Socket.IO
      if (socket && socket.connected) {
        socket.emit("quizDataUploaded", quizData);
      }
    } catch (err) {
      console.error("JSON parse error:", err);
      const output = document.getElementById("output");
      if (output) {
        output.textContent = "Invalid JSON file";
      }
    }
  };

  reader.readAsText(file);
}

// Load example quiz data
fetch("/example.json")
  .then((res) => res.json())
  .then((data) => {
    const example = document.getElementById("Example");
    if (example) {
      example.textContent = JSON.stringify(data, null, 2);
    }
  })
  .catch((err) => {
    console.error("Failed to load example:", err);
    const example = document.getElementById("Example");
    if (example) {
      example.textContent = "Failed to load JSON file";
    }
  });

// Theme toggle functionality
function setCookie(name, value, days = 365) {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/`;
}

function getCookie(name) {
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [key, value] = cookie.split("=");
    if (key === name) return value;
  }
  return null;
}

function applyTheme(theme) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(theme);
}

const savedTheme = getCookie("theme") || "light";
applyTheme(savedTheme);

const themeToggle = document.getElementById("themeToggle");
if (themeToggle) {
  themeToggle.onclick = () => {
    const newTheme = document.body.classList.contains("light")
      ? "dark"
      : "light";
    applyTheme(newTheme);
    setCookie("theme", newTheme);
  };
}

// Create quiz from user input
const createQuizBtn = document.getElementById("createQuizBtn");
if (createQuizBtn) {
  createQuizBtn.addEventListener("click", () => {
    const quizInputs = document.querySelectorAll(".question");
    const rightAnswers = document.querySelectorAll(".Right");
    const wrongAnswers = document.querySelectorAll(".Wrong");

    const questions = [];

    for (let i = 0; i < quizInputs.length; i++) {
      const question = quizInputs[i].value.trim();
      const rightAnswer = rightAnswers[i].value.trim();
      const wrongAnswer1 = wrongAnswers[i * 3]?.value.trim();
      const wrongAnswer2 = wrongAnswers[i * 3 + 1]?.value.trim();
      const wrongAnswer3 = wrongAnswers[i * 3 + 2]?.value.trim();

      if (
        question &&
        rightAnswer &&
        wrongAnswer1 &&
        wrongAnswer2 &&
        wrongAnswer3
      ) {
        const options = [rightAnswer, wrongAnswer1, wrongAnswer2, wrongAnswer3];

        questions.push({
          id: `q${i + 1}`,
          question: question,
          options: options,
          correctAnswer: 0,
          points: 10,
          category: "Custom",
        });
      }
    }

    if (questions.length > 0) {
      quizData = {
        quizId: `custom-quiz-${Date.now()}`,
        title: "Custom Quiz",
        description: "User-created quiz",
        timePerQuestion: 30,
        questions: questions,
      };

      console.log("Created quiz data:", quizData);
      const written = document.getElementById("written");
      if (written) {
        written.textContent = JSON.stringify(quizData, null, 2);
      }

      if (socket && socket.connected) {
        socket.emit("quizDataCreated", quizData);
      }
    } else {
      alert("Please fill in all fields.");
    }
  });
}

// Room joining functionality
const join_btn = document.getElementById("join_btn");
const room_code_input = document.getElementById("room_code_input");

if (join_btn && room_code_input) {
  join_btn.addEventListener("click", () => {
    const roomCode = room_code_input.value.trim();
    if (roomCode) {
      if (socket && socket.connected) {
        socket.emit("join_room", roomCode);
      } else {
        alert("Not connected to server. Please refresh the page.");
      }
    } else {
      alert("Please enter a room code.");
    }
  });
}

// Display question in UI
function displayQuestion(questionData) {
  const questionContainer = document.getElementById("questionContainer");
  if (!questionContainer) return;

  questionContainer.innerHTML = `
    <div class="question-box">
      <h3>Question ${questionData.questionNumber} / ${
    questionData.totalQuestions
  }</h3>
      <p class="question-text">${questionData.question}</p>
      <div class="options">
        ${questionData.options
          .map(
            (option, index) => `
          <button class="option-btn" onclick="submitAnswer('${questionData.questionNumber}', ${index})">
            ${option}
          </button>
        `
          )
          .join("")}
      </div>
      <p class="timer">Time remaining: ${questionData.timeLimit}s</p>
    </div>
  `;
}

// Show answer feedback
function showAnswerFeedback(data) {
  const feedback = document.getElementById("feedback");
  if (feedback) {
    feedback.innerHTML = `
      <p class="${data.correct ? "correct" : "incorrect"}">
        ${data.correct ? "✓ Correct!" : "✗ Incorrect"}
      </p>
      <p>Points earned: ${data.points}</p>
      <p>Your score: ${data.newScore}</p>
    `;
  }
}

// Display final results
function displayResults(results) {
  const resultsContainer = document.getElementById("resultsContainer");
  if (!resultsContainer) return;

  resultsContainer.innerHTML = `
    <h2>Quiz Results</h2>
    <div class="winner">
      <h3>🏆 Winner: ${results.winner.name}</h3>
      <p>Score: ${results.winner.score}</p>
    </div>
    <h3>Leaderboard</h3>
    <ol class="leaderboard">
      ${results.results
        .map(
          (player) => `
        <li>${player.name}: ${player.score} points</li>
      `
        )
        .join("")}
    </ol>
  `;
}

// Helper functions to interact with Socket.IO
function startQuiz(roomCode) {
  if (!socket || !socket.connected) {
    alert("Not connected to server. Please refresh the page.");
    return;
  }

  if (quizData) {
    socket.emit("start_quiz", roomCode);
  } else {
    alert("No quiz data available. Please upload or create a quiz first.");
  }
}

function joinQuizRoom(roomCode, playerName) {
  if (!socket || !socket.connected) {
    alert("Not connected to server. Please refresh the page.");
    return;
  }
  socket.emit("join_room", roomCode);
}

function submitAnswer(questionId, answerIndex) {
  if (!socket || !socket.connected) {
    alert("Not connected to server.");
    return;
  }
  socket.emit("submitAnswer", {
    questionId,
    answerIndex,
    timestamp: Date.now(),
  });
}

function downloadQuizData() {
  if (quizData) {
    const dataStr = JSON.stringify(quizData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quiz-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  } else {
    alert("No quiz data to download.");
  }
}

// Expose functions globally for use in HTML
window.startQuiz = startQuiz;
window.joinQuizRoom = joinQuizRoom;
window.submitAnswer = submitAnswer;
window.downloadQuizData = downloadQuizData;
