document.addEventListener('DOMContentLoaded', () => {
    // In a real application, this user data should come from a secure server.
    const users = [
        { username: 'user1', password: 'p1' },
        { username: 'user2', password: 'p2' },
        { username: 'user3', password: 'p3' },
        { username: 'user4', password: 'p4' },
        { username: 'user5', password: 'p5' },
        { username: 'user6', password: 'p6' },
        { username: 'user7', password: 'p7' },
        { username: 'user8', password: 'p8' },
        { username: 'user9', password: 'p9' },
        { username: 'user10', password: 'p10' }
    ];

    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        const foundUser = users.find(user => user.username === username && user.password === password);

        if (foundUser) {
            // Store the logged-in user in sessionStorage to maintain the session
            sessionStorage.setItem('loggedInUser', username);
            // Redirect to the main application page
            window.location.href = 'main.html';
        } else {
            // Show the error message if login fails
            errorMessage.style.display = 'block';
        }
    });
});