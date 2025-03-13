// Terminal typing effect
document.addEventListener('DOMContentLoaded', function() {
    // Update footer year
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Typing effect
    const textElement = document.getElementById('typing-text');
    const textToType = [
        'Hello, World!',
        'I am Dario Turchi.',
        'Full Stack Developer.',
        'Navigating Software & Finance.',
        'Specializing in .NET, C#, and SQL.',
        'cat skills.txt',
        'Scroll down to see my work...'
    ];
    
    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingSpeed = 100;
    
    function typeText() {
        const currentText = textToType[textIndex];
        
        if (isDeleting) {
            textElement.textContent = currentText.substring(0, charIndex - 1);
            charIndex--;
            typingSpeed = 50;
        } else {
            textElement.textContent = currentText.substring(0, charIndex + 1);
            charIndex++;
            typingSpeed = 100;
        }
        
        if (!isDeleting && charIndex === currentText.length) {
            isDeleting = true;
            typingSpeed = 1500; // Pause at the end
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            textIndex = (textIndex + 1) % textToType.length;
            typingSpeed = 500; // Pause before typing next text
        }
        
        setTimeout(typeText, typingSpeed);
    }
    
    // Start the typing effect
    setTimeout(typeText, 1000);
    
    // Load GitHub repositories
    loadGitHubRepos();
    
    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            
            // Filter repos
            const filter = this.getAttribute('data-filter');
            filterRepos(filter);
        });
    });
});

// Function to load GitHub repositories
async function loadGitHubRepos() {
    const username = '0xDario'; // Your GitHub username
    const repoContainer = document.getElementById('repo-container');
    const loader = document.getElementById('repo-loader');
    
    try {
        const response = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=12`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch repositories');
        }
        
        const repos = await response.json();
        
        // Filter to only include non-forked repositories
        const ownRepos = repos.filter(repo => !repo.fork);
        
        // Hide loader
        loader.style.display = 'none';
        
        // Create HTML for each repo
        ownRepos.forEach(repo => {
            let repoLanguageClass = 'other';
            
            // Categorize repos based on language
            if (repo.language) {
                if (repo.language.toLowerCase().includes('c#') || 
                    repo.language.toLowerCase().includes('.net')) {
                    repoLanguageClass = '.net';
                } else if (repo.language.toLowerCase().includes('javascript') || 
                         repo.language.toLowerCase().includes('typescript')) {
                    repoLanguageClass = 'javascript';
                }
            }
            
            const repoEl = document.createElement('div');
            repoEl.className = `repo-card ${repoLanguageClass}`;
            
            // Create repo description or use a placeholder
            const description = repo.description || 'No description available';
            
            repoEl.innerHTML = `
                <h3>${repo.name}</h3>
                <p>${description}</p>
                <div class="repo-footer">
                    <div class="repo-stats">
                        <div class="repo-stat">
                            <i class="fas fa-star"></i> ${repo.stargazers_count}
                        </div>
                        <div class="repo-stat">
                            <i class="fas fa-code-branch"></i> ${repo.forks_count}
                        </div>
                    </div>
                    <div class="repo-language">${repo.language || 'N/A'}</div>
                    <a href="${repo.html_url}" target="_blank" class="repo-link">
                        <i class="fas fa-code"></i> View
                    </a>
                </div>
            `;
            
            repoContainer.appendChild(repoEl);
        });
        
        // If no repos found
        if (ownRepos.length === 0) {
            repoContainer.innerHTML = `<div class="no-repos">No repositories found</div>`;
        }
        
    } catch (error) {
        console.error('Error loading GitHub repositories:', error);
        loader.innerHTML = `<p>Error loading repositories. Please try again later.</p>`;
    }
}

// Function to filter repositories
function filterRepos(filter) {
    const repoCards = document.querySelectorAll('.repo-card');
    
    repoCards.forEach(card => {
        if (filter === 'all') {
            card.style.display = 'block';
        } else if (card.classList.contains(filter)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        
        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 70,
                behavior: 'smooth'
            });
        }
    });
});

// Reveal animations on scroll
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
        }
    });
}, {
    threshold: 0.1
});

// Observe all sections
document.querySelectorAll('section').forEach(section => {
    section.classList.add('reveal');
    observer.observe(section);
});
