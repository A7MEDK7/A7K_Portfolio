document.addEventListener('DOMContentLoaded', function () {

    const texts = [
        "Full Stack Developer",
        "Software Engineering",
        "React.js Developer",
        "ASP.NET Developer"
    ];

    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingSpeed = 90;
    let deletingSpeed = 50;
    let pauseTime = 700;

    function typeEffect() {
        const currentText = texts[textIndex];
        const typedTextElement = document.getElementById('typed-text');

        if (typedTextElement) {
            if (isDeleting) {
                typedTextElement.textContent = currentText.substring(0, charIndex - 1);
                charIndex--;
            } else {
                typedTextElement.textContent = currentText.substring(0, charIndex + 1);
                charIndex++;
            }

            if (!isDeleting && charIndex === currentText.length) {
                setTimeout(() => {
                    isDeleting = true;
                    typeEffect();
                }, pauseTime);
                return;
            }

            if (isDeleting && charIndex === 0) {
                isDeleting = false;
                textIndex = (textIndex + 1) % texts.length;
            }
            const speed = isDeleting ? deletingSpeed : typingSpeed;
            setTimeout(typeEffect, speed);
        }
    }

    setTimeout(typeEffect, 1000);

    const lightEffect = document.getElementById('light-effect');
    const homeSection = document.getElementById('home');

    if (lightEffect && homeSection) {
        homeSection.addEventListener('mousemove', (e) => {
            const rect = homeSection.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;

            lightEffect.style.setProperty('--mouse-x', `${x}%`);
            lightEffect.style.setProperty('--mouse-y', `${y}%`);
        });

        homeSection.addEventListener('mouseleave', () => {
            lightEffect.style.opacity = '0';
        });

        homeSection.addEventListener('mouseenter', () => {
            lightEffect.style.opacity = '0.8';
        });
    }

    const fadeElements = document.querySelectorAll('.fade-in-section');

    function checkFade() {
        fadeElements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight * 0.9 && rect.bottom >= 0;

            if (isVisible) {
                element.classList.add('is-visible');
            }
        });
    }

    checkFade();
    window.addEventListener('scroll', checkFade);

    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const navBar = document.getElementById('navbar');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            navBar.classList.toggle('rounded-none');
            mobileMenu.classList.toggle('hidden');
        });

        const mobileLinks = mobileMenu.querySelectorAll('a');
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                navBar.classList.toggle('rounded-none');
                mobileMenu.classList.add('hidden');
            });
        });
    }

    document.addEventListener("click", (e) => {
        if (!navbar.contains(e.target)) {
            mobileMenu.classList.add("hidden");
            navBar.classList.remove('rounded-none');
        }
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });

    const circles = document.querySelectorAll('.floating-circle');

    circles.forEach(circle => {
        const randomX = Math.random() * 20 - 10;
        const randomY = Math.random() * 20 - 10;
        const duration = 20 + Math.random() * 10;

        circle.style.animation = `float ${duration}s ease-in-out infinite`;

        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            @keyframes float {
                0%, 100% {
                    transform: translate(0, 0);
                }
                25% {
                    transform: translate(${randomX}px, ${randomY}px);
                }
                50% {
                    transform: translate(${-randomX}px, ${-randomY}px);
                }
                75% {
                    transform: translate(${randomY}px, ${-randomX}px);
                }
            }
        `;
        document.head.appendChild(styleSheet);
    });
});

// Simple interactive effects
document.addEventListener('DOMContentLoaded', function () {
    const items = document.querySelectorAll('.experience-item, .education-item');

    items.forEach(item => {
        item.addEventListener('mouseenter', function () {
            this.style.transform = 'translateY(-5px)';
        });

        item.addEventListener('mouseleave', function () {
            this.style.transform = 'translateY(0)';
        });
    });

    // Scroll animation effect
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Set initial state for animation
    items.forEach(item => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        item.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(item);
    });

    // Add click effect on items
    items.forEach(item => {
        item.addEventListener('click', function () {
            this.style.transform = 'scale(0.99)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
});


// Select all nav links
const navLinks = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll("section");

// When Scroll
window.addEventListener('scroll', () => {
    let current = '';

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;

        if (scrollY >= (sectionTop - 200)) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('text-blue-800');
        link.classList.add('text-text-secondary');

        if (link.getAttribute('href').slice(1) === current) {
            link.classList.remove('text-text-secondary');
            link.classList.add('text-blue-800');
        }
    });
});