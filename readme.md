Goal for project:

admin

- allow admin to paste in a json file following a specific template and decide which answer is the correct one
- active display showing a persons username and which question they are on, once user is finished it shows accuracy
- ability to force nicknames upon user for moderation reasons
- ability to chose between name list or custom userames
- ability to chose randomized question order or numerical order
- ability to force close room(requires 2 step verification to prevent accidental deletion )
- ability to force end( end at any point no matter if everyone has answered everything and calculates accuracy for admin)

  users

- user is shown 1 question at a time and cant move on until answered
- do not check accuracy till end
- allow users to write their own usernames, or if forced by admin a custom picked username, no duplicate usernames, only letters no special symbols (spaces allowed)

server side

- create a room system with one admin and inf users
- first person in server defualt to admin
- display multiple chose answers from json file
- room names
- room codes (if none provided defualt to CMP)

Done:

- Json Upload
- dark and light mode selects(saves via a cookie)

Alternate approach for data sending:

- store accuracy locally then only send which questions were right and wrong then user and accuracy to a room code not a room system
