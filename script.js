// JavaScript to load projects from GitHub
const loadProjects = async () => {
    const username = '0xdario'; // Your GitHub username
    const response = await fetch(`https://api.github.com/users/${username}/repos?sort=updated`);
    const repos = await response.json();

    const container = document.getElementById('projects-container');
    repos.forEach(repo => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <div class="container">
                <h4>
                    <a href="${repo.html_url}" target="_blank">
                        ${repo.name} <i class="fab fa-github"></i>
                    </a>
                </h4>
                <p>${repo.description || 'No description'}</p>
            </div>
        `;
        container.appendChild(card);
    });
};

document.addEventListener('DOMContentLoaded', loadProjects);
