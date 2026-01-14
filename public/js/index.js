const join_btn = document.getElementById("join_btn");
const room_code_input = document.getElementById("room_code_input");

join_btn.addEventListener("click", () => {
  const roomCode = room_code_input.value.trim();
  if (roomCode) {
    socket.emit("join_room", roomCode);
  } else {
    alert("Please enter a room code.");
  }
});

socket.on("room_joined", (roomCode) => {
  console.log(`Joined room: ${roomCode}`);
  socket.emit("start_quiz", roomCode);
});

// Expose functions globally for use in HTML
window.startQuiz = startQuiz;
window.joinQuizRoom = joinQuizRoom;
window.submitAnswer = submitAnswer;
window.downloadQuizData = downloadQuizData;
