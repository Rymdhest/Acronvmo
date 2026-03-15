const SUPABASE_URL = "https://zwhfduqglxwisgvthknu.supabase.co";
const SUPABASE_KEY = "sb_publishable_HfgHtVKolI_6vjlYOFEsyw_GH3OfLIw"; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let score = 0;
let lives = 3;
let currentCorrectIndex = null;
let isProcessing = false;
let usedQuestionIds = [];
let totalQuestionsInDb = 0;
let waitingForContinue = false;
async function init() {
    updateUI();
    await getNewQuestion();
}

async function getNewQuestion() {
    const message = document.getElementById('question-box');
    
    const { data: glossary, error } = await _supabase.from('glossary').select('*');
    
    if (error || !glossary || glossary.length === 0) {
        console.error("DB Error:", error);
        message.innerText = "OFFLINE";
        return;
    }

    const availableQuestions = glossary.filter(q => !usedQuestionIds.includes(q.id));

    if (availableQuestions.length === 0) {
        const overlay = document.getElementById('game-over-overlay');
        overlay.querySelector('.glitch-text').innerText = "YOU WON";
        showGameOver();
        return;
    }

    const target = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    usedQuestionIds.push(target.id); 

    const acronym = target.acronym;
    const correctAnswer = target.full_name;

    const glyphs = acronym.match(/[A-Z][a-z]*|[0-9]+/g);
    const options = [correctAnswer];


    const { data: allWords, error: bankError } = await _supabase
        .from('word_bank')
        .select('glyph_id, word')
        .in('glyph_id', glyphs);

    if (bankError) {
        console.error("Word Bank Error:", bankError);
        return;
    }
    const localBank = {};
    allWords.forEach(entry => {
        if (!localBank[entry.glyph_id]) localBank[entry.glyph_id] = [];
        localBank[entry.glyph_id].push(entry.word);
    });
    // Generate 3 Fake Answers 
    for (let i = 0; i < 3; i++) {
        let fakePhrase = "";
        let isDuplicate = true;
        let attempts = 0;

        while (isDuplicate) {
            attempts++;
            let tempPhrase = [];

            for (const g of glyphs) {
                const wordsForGlyph = localBank[g] || ["UNKNOWN"];
                const randomWord = wordsForGlyph[Math.floor(Math.random() * wordsForGlyph.length)];
                tempPhrase.push(randomWord);
            }

            fakePhrase = tempPhrase.join(' ');

            if (!options.includes(fakePhrase) || attempts > 20) {
                if (options.includes(fakePhrase)) {
                    fakePhrase += ` ERROR `+`(${String.fromCharCode(64 + i)})`; // Adds (A), (B), or (C) if stuck
                }
                isDuplicate = false;
            }
        }
        options.push(fakePhrase);
    }

    const shuffled = options.sort(() => Math.random() - 0.5);
    currentCorrectIndex = shuffled.indexOf(correctAnswer);

    message.innerText = acronym;
    shuffled.forEach((opt, i) => {
        const btnText = document.getElementById(`opt${i}`);
        if (btnText) btnText.innerText = opt;
    });
    
    isProcessing = false;
}

async function handleChoice(idx) {
    if (isProcessing || waitingForContinue) return;
    isProcessing = true;

    const buttons = document.querySelectorAll('.answer-btn');
    const message = document.getElementById('question-box');

    if (idx === currentCorrectIndex) {
        score++;
        spawnBackgroundGlyph(); 
        buttons[idx].classList.add('correct-reveal');
        triggerFlash("var(--neon-blue)");
        spawnSplat("+1", "var(--gold)");
        updateUI();
        
        setTimeout(async () => {
            buttons[idx].classList.remove('correct-reveal');
            await getNewQuestion();
            isProcessing = false;
        }, 400);

    } else {
        lives--;
        updateUI();
        
        document.body.style.backgroundColor = "var(--blood-red)";
        setTimeout(() => document.body.style.backgroundColor = "#020005", 200);

        buttons.forEach((btn, i) => {
            if (i === currentCorrectIndex) {
                btn.style.setProperty('background-color', '#00d4ff', 'important');
                btn.style.setProperty('color', '#000', 'important');
                btn.style.setProperty('box-shadow', '0 0 20px #00d4ff', 'important');
            } else {
                btn.classList.add('dimmed');
            }
        });

        spawnSplat("-1 LIFE", "red");
        
        const prompt = document.getElementById('continue-prompt');
        prompt.innerText = (lives <= 0) ? "GAME OVER - CLICK TO REVEAL" : "CLICK ANYWHERE TO CONTINUE";
        prompt.style.opacity = "1";
        prompt.style.color = "var(--neon-blue)";
        
        setTimeout(() => {
            waitingForContinue = true;
            isProcessing = false; 
        }, 100);
    }
}

document.addEventListener('mousedown', async () => {
    if (waitingForContinue) {
        waitingForContinue = false;
        isProcessing = true; 

        const buttons = document.querySelectorAll('.answer-btn');
        const prompt = document.getElementById('continue-prompt');

        buttons.forEach(btn => {
            btn.style.backgroundColor = "";
            btn.style.color = "";
            btn.style.boxShadow = "";
            btn.classList.remove('dimmed');
        });
        
        if (prompt) prompt.style.opacity = "0";

        if (lives <= 0) {
            showGameOver();
        } else {
            await getNewQuestion();
            isProcessing = false;
        }
    }
});
function resetButtonStyles(btns) {
    for (let i = 0; i < btns.length; i++) {
        btns[i].style.backgroundColor = "";
        btns[i].style.color = "";
        btns[i].style.boxShadow = "";
        btns[i].style.border = "";
        btns[i].style.opacity = "";
    }
}

function updateUI() {
    document.getElementById('score').innerText = score;

    const hearts = document.querySelectorAll('.heart');
    hearts.forEach((heart, index) => {
        if (index >= lives) {
            heart.classList.add('lost');
        } else {
            heart.classList.remove('lost');
        }
    });
}

function triggerFlash(color) {
    const card = document.getElementById('main-card');
    const originalBorder = card.style.borderColor;
    card.style.backgroundColor = color;
    setTimeout(() => {
        card.style.backgroundColor = "#000";
    }, 100);
}

function spawnSplat(text, color) {
    const splat = document.createElement('div');
    splat.className = 'floating-text'; 
    splat.innerText = text;
    splat.style.position = 'fixed';
    splat.style.left = '50%';
    splat.style.top = '40%';
    splat.style.color = color;
    splat.style.fontSize = '3rem';
    splat.style.fontWeight = 'bold';
    splat.style.pointerEvents = 'none';
    splat.style.zIndex = '1000';
    
    document.body.appendChild(splat);
    
    let opacity = 1;
    let yPos = 40;
    const anim = setInterval(() => {
        opacity -= 0.01;
        yPos -= 0.2;
        splat.style.opacity = opacity;
        splat.style.top = yPos + '%';
        if (opacity <= 0) {
            clearInterval(anim);
            splat.remove();
        }
    }, 10);
}
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'd' && !isProcessing) handleChoice(currentCorrectIndex);
});


function showGameOver() {
    const overlay = document.getElementById('game-over-overlay');
    document.getElementById('final-score').innerText = score;
    overlay.classList.remove('hidden');
    isProcessing = true; 
}

async function uploadScore() {
    const nameInput = document.getElementById('player-name');
    const name = nameInput.value.trim() || "ANON";
    const btn = document.getElementById('submit-btn');

    btn.disabled = true;
    btn.innerText = "UPLOADING...";

    const { error } = await _supabase
        .from('highscores')
        .insert([{ player_name: name, score: score }]);

    if (!error) {
        btn.innerText = "SAVED";
        await fetchLeaderboard();
        setTimeout(resetGame, 1000);
    } else {
        btn.innerText = "RETRY?";
        btn.disabled = false;
    }
}

function validateInput() {
    const nameInput = document.getElementById('player-name');
    const submitBtn = document.getElementById('submit-btn');
    
    if (nameInput.value.trim().length > 0) {
        submitBtn.disabled = false;
    } else {
        submitBtn.disabled = true;
    }
}

function spawnBackgroundGlyph() {
    const container = document.getElementById('background-data-layer');
    if (!container) return;

    const currentAcronym = document.getElementById('question-box').textContent;
    if (currentAcronym === "READY?" || currentAcronym === ". . .") return;

    const glyph = document.createElement('div');
    glyph.className = 'bg-glyph';
    glyph.textContent = currentAcronym;

    glyph.style.left = `${Math.random() * 85}%`;
    glyph.style.top = `${Math.random() * 85}%`;

    glyph.style.setProperty('--rot', `${(Math.random() - 0.5) * 45}deg`);
    glyph.style.setProperty('--op', 0.6 );
    glyph.style.setProperty('--size', `${2.0}rem`);

    container.appendChild(glyph);
}
function resetGame() {
    score = 0;
    lives = 3;
    isProcessing = false;
    usedQuestionIds = [];
    waitingForContinue = false;

    document.getElementById('background-data-layer').innerHTML = '';
    const overlay = document.getElementById('game-over-overlay');
    overlay.classList.add('hidden');
    overlay.querySelector('.glitch-text').innerText = "GAME OVER";


    const btn = document.getElementById('submit-btn');
    btn.innerText = "UPLOAD TO HIGHSCORE";

    const nameInput = document.getElementById('player-name');
    if (nameInput) nameInput.value = "";
    updateUI();
    getNewQuestion();
}

async function fetchLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    
    const { data, error } = await _supabase
        .from('highscores')
        .select('player_name, score')
        .order('score', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Leaderboard Sync Error:", error);
        return;
    }

    list.innerHTML = '';
    data.forEach((entry, index) => {
        const li = document.createElement('li');
        li.className = 'leader-row';
        li.innerHTML = `
            <span class="name">${index + 1}. ${entry.player_name}</span>
            <span class="val">${entry.score}</span>
        `;
        list.appendChild(li);
    });
}
document.addEventListener('DOMContentLoaded', fetchLeaderboard);

init();