// 2099 Futuristic Menu JavaScript

document.addEventListener('DOMContentLoaded', function() {
    const enterBtn = document.getElementById('enterBtn');
    const aiCore = document.querySelector('.ai-core');
    
    // Add particle effects to button
    createButtonParticles();
    
    // Add sound effect simulation (visual feedback)
    enterBtn.addEventListener('mouseenter', function() {
        this.style.animation = 'none';
        setTimeout(() => {
            this.style.animation = 'btn-float 3s ease-in-out infinite';
        }, 10);
    });
    
    // Enter button click handler
    enterBtn.addEventListener('click', function() {
        initiateSystemAccess();
    });
    
    // Add keyboard shortcut (Enter key)
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            initiateSystemAccess();
        }
    });
    
    // Create random particles around AI core
    setInterval(createCoreParticles, 500);
});

function createButtonParticles() {
    const btn = document.querySelector('.enter-btn');
    const particlesContainer = btn.querySelector('.btn-particles');
    
    setInterval(() => {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = '2px';
        particle.style.height = '2px';
        particle.style.background = '#00ffff';
        particle.style.borderRadius = '50%';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animation = 'particle-fade 2s ease-out forwards';
        particle.style.boxShadow = '0 0 5px #00ffff';
        
        particlesContainer.appendChild(particle);
        
        setTimeout(() => particle.remove(), 2000);
    }, 200);
}

function createCoreParticles() {
    const core = document.querySelector('.ai-core');
    const particle = document.createElement('div');
    
    particle.style.position = 'absolute';
    particle.style.width = '3px';
    particle.style.height = '3px';
    particle.style.background = '#00ffff';
    particle.style.borderRadius = '50%';
    particle.style.boxShadow = '0 0 10px #00ffff';
    particle.style.left = '50%';
    particle.style.top = '50%';
    particle.style.pointerEvents = 'none';
    
    const angle = Math.random() * Math.PI * 2;
    const distance = 150;
    const duration = 2000;
    
    particle.style.animation = `particle-explode ${duration}ms ease-out forwards`;
    particle.style.setProperty('--angle', angle);
    particle.style.setProperty('--distance', distance + 'px');
    
    core.appendChild(particle);
    
    setTimeout(() => particle.remove(), duration);
}

function initiateSystemAccess() {
    const container = document.querySelector('.container');
    const enterBtn = document.getElementById('enterBtn');
    
    // Disable button
    enterBtn.disabled = true;
    enterBtn.style.opacity = '0.5';
    
    // Create access sequence
    const statusValues = document.querySelectorAll('.status-value');
    let delay = 0;
    
    statusValues.forEach((status, index) => {
        setTimeout(() => {
            status.textContent = 'VERIFYING...';
            status.style.color = '#ffff00';
            
            setTimeout(() => {
                status.textContent = 'CONFIRMED';
                status.style.color = '#00ff00';
            }, 500);
        }, delay);
        delay += 300;
    });
    
    // Initiate transition after verification
    setTimeout(() => {
        // Create white flash effect
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100vw';
        flash.style.height = '100vh';
        flash.style.background = 'rgba(0, 255, 255, 0.9)';
        flash.style.zIndex = '9999';
        flash.style.animation = 'flash-fade 1s ease-out forwards';
        document.body.appendChild(flash);
        
        // Add CSS animation for flash
        const style = document.createElement('style');
        style.textContent = `
            @keyframes flash-fade {
                0% { opacity: 0; }
                50% { opacity: 1; }
                100% { opacity: 0; }
            }
            @keyframes particle-fade {
                0% { opacity: 1; transform: scale(1); }
                100% { opacity: 0; transform: scale(0); }
            }
            @keyframes particle-explode {
                0% { 
                    transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0);
                    opacity: 1;
                }
                100% { 
                    transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--distance));
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
        
        // Redirect to main app
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }, delay + 500);
}

// Add matrix rain effect
function createMatrixRain() {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '1';
    canvas.style.opacity = '0.1';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);
    
    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#00ffff';
        ctx.font = fontSize + 'px monospace';
        
        for (let i = 0; i < drops.length; i++) {
            const text = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
            
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }
    
    setInterval(draw, 50);
}

// Initialize matrix rain
createMatrixRain();

// Add hover effect to AI core
document.querySelector('.ai-core').addEventListener('mouseenter', function() {
    this.style.filter = 'drop-shadow(0 0 50px rgba(0, 255, 255, 1))';
});

document.querySelector('.ai-core').addEventListener('mouseleave', function() {
    this.style.filter = 'drop-shadow(0 0 30px rgba(0, 255, 255, 0.8))';
});