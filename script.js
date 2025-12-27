// State
let currentHint = null;
let showingCandidates = false;
let originalPuzzle = null;
let solverStartTime = 0;
const SOLVER_TIMEOUT = 5000;

document.addEventListener('DOMContentLoaded', () => {
    initializeGrid();
    setupEventListeners();
    // Check for URL params immediately
    loadFromURL();
});

function initializeGrid() {
    const table = document.getElementById("sudokuGrid");
    table.innerHTML = "";
    for (let i = 0; i < 9; i++) {
        const row = table.insertRow();
        for (let j = 0; j < 9; j++) {
            const cell = row.insertCell();
            const input = document.createElement("input");
            input.type = "text"; 
            input.inputMode = "numeric";
            input.maxLength = 1;
            input.dataset.row = i;
            input.dataset.col = j;
            input.autocomplete = "off";

            // Keyboard Navigation
            input.addEventListener('keydown', (e) => handleKeyNavigation(e, i, j));

            // Input Handling
            input.addEventListener("input", function() {
                const val = this.value.replace(/[^1-9]/g, "");
                this.value = val;
                
                if (val) {
                    this.classList.add('pop-in');
                    setTimeout(() => this.classList.remove('pop-in'), 200);
                }
                
                if (showingCandidates) showAllCandidates();
                this.classList.remove('incorrect', 'hint', 'related');
            });

            // Focus Effects
            input.addEventListener('focus', () => highlightRelatedCells(i, j, true));
            input.addEventListener('blur', () => highlightRelatedCells(i, j, false));

            cell.appendChild(input);
        }
    }
}

function handleKeyNavigation(e, row, col) {
    let nextRow = row, nextCol = col;
    if (e.key === "ArrowUp") nextRow = Math.max(0, row - 1);
    else if (e.key === "ArrowDown") nextRow = Math.min(8, row + 1);
    else if (e.key === "ArrowLeft") nextCol = Math.max(0, col - 1);
    else if (e.key === "ArrowRight") nextCol = Math.min(8, col + 1);
    else return;

    e.preventDefault();
    const nextInput = document.querySelector(`input[data-row="${nextRow}"][data-col="${nextCol}"]`);
    if (nextInput) {
        nextInput.focus();
        nextInput.select();
    }
}

function highlightRelatedCells(row, col, active) {
    if (!active) {
        document.querySelectorAll('td').forEach(td => td.classList.remove('focused-cell-group'));
        return;
    }
    
    document.querySelectorAll('input').forEach(input => {
        const r = parseInt(input.dataset.row);
        const c = parseInt(input.dataset.col);
        const sameBox = Math.floor(r/3) === Math.floor(row/3) && Math.floor(c/3) === Math.floor(col/3);
        
        if (r === row || c === col || sameBox) {
             input.parentElement.classList.add('focused-cell-group');
        }
    });
}

function setupEventListeners() {
    document.getElementById('btn-hint').addEventListener('click', getNextHint);
    document.getElementById('btn-apply').addEventListener('click', applyHint);
    document.getElementById('btn-candidates').addEventListener('click', toggleCandidates);
    document.getElementById('btn-clear-colors').addEventListener('click', clearHighlights);
    
    document.getElementById('btn-check').addEventListener('click', checkRules);
    document.getElementById('btn-solve').addEventListener('click', checkSolution);
    document.getElementById('btn-lock').addEventListener('click', lockPuzzle);
    document.getElementById('btn-clear').addEventListener('click', clearGrid);
    
    document.getElementById('btn-export').addEventListener('click', exportGrid);
    document.getElementById('btn-import').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('btn-share').addEventListener('click', shareViaURL);
    document.getElementById('btn-load-url').addEventListener('click', loadFromURL);
    
    document.getElementById('importFile').addEventListener('change', (e) => {
        if (e.target.files.length) handleImport(e.target.files[0]);
    });
    
    setupImageUpload();
}

function setupImageUpload() {
    const uploadArea = document.getElementById("uploadArea");
    const imageUpload = document.getElementById("imageUpload");
    
    uploadArea.addEventListener("click", () => imageUpload.click());
    uploadArea.addEventListener("dragover", (e) => { 
        e.preventDefault(); 
        uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener("dragleave", () => { 
        uploadArea.classList.remove('dragover');
    });
    uploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleImage(e.dataTransfer.files[0]);
    });
    
    imageUpload.addEventListener("change", (e) => {
        if (e.target.files.length) handleImage(e.target.files[0]);
    });
}

// --- Core Helper Functions ---

function getGrid() {
    const grid = Array(9).fill().map(() => Array(9).fill(0));
    document.querySelectorAll("#sudokuGrid input").forEach(input => {
        const val = parseInt(input.value);
        if (val >= 1 && val <= 9) {
            grid[input.dataset.row][input.dataset.col] = val;
        }
    });
    return grid;
}

function setGrid(grid) {
    document.querySelectorAll("#sudokuGrid input").forEach(input => {
        const r = input.dataset.row;
        const c = input.dataset.col;
        const val = grid[r][c];
        input.value = val > 0 ? val : "";
        input.classList.remove("solved", "hint", "related", "incorrect");
    });
}

function getBoxName(row, col) {
    const boxRow = Math.floor(row / 3);
    const boxCol = Math.floor(col / 3);
    const boxNames = [
        ["Top-Left", "Top-Center", "Top-Right"],
        ["Middle-Left", "Center", "Middle-Right"],
        ["Bottom-Left", "Bottom-Center", "Bottom-Right"]
    ];
    return boxNames[boxRow][boxCol];
}

function showMessage(content, type = "info") {
    const messageDiv = document.getElementById("message");
    messageDiv.innerHTML = content;
    messageDiv.className = type;
}

// --- Candidates & Validation ---

function getCandidates(grid, row, col) {
    if (grid[row][col] !== 0) return [];
    const candidates = [];
    for (let num = 1; num <= 9; num++) {
        if (isValidPlacement(grid, row, col, num)) candidates.push(num);
    }
    return candidates;
}

function getAllCandidates(grid) {
    const candidates = Array(9).fill().map(() => Array(9).fill().map(() => []));
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            candidates[r][c] = getCandidates(grid, r, c);
        }
    }
    return candidates;
}

function isValidPlacement(grid, row, col, num) {
    for (let x = 0; x < 9; x++) if (grid[row][x] === num) return false;
    for (let x = 0; x < 9; x++) if (grid[x][col] === num) return false;
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            if (grid[boxRow + i][boxCol + j] === num) return false;
    return true;
}

function applyEliminationTechniques(candidates) {
  // Deep copy to avoid mutating original state incorrectly
  const refined = candidates.map(row => row.map(c => [...c]));
  return refined;
}

function toggleCandidates() {
    if(showingCandidates) {
        document.querySelectorAll(".candidates").forEach(el => el.remove());
        showingCandidates = false;
    } else {
        showAllCandidates();
    }
}

function showAllCandidates() {
    const grid = getGrid();
    const cands = getAllCandidates(grid);
    showingCandidates = true;

    document.querySelectorAll(".candidates").forEach(el => el.remove());

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (grid[row][col] === 0 && cands[row][col].length > 0) {
                const cell = document.querySelector(`input[data-row="${row}"][data-col="${col}"]`).parentElement;
                const candDiv = document.createElement("div");
                candDiv.className = "candidates";
                for (let n = 1; n <= 9; n++) {
                    const span = document.createElement("span");
                    span.textContent = cands[row][col].includes(n) ? n : "";
                    candDiv.appendChild(span);
                }
                cell.appendChild(candDiv);
            }
        }
    }
}

// --- Solver Algorithms (Backtracking) ---

function solvePuzzle(grid, findAllSolutions = false, maxSolutions = 2) {
    const copy = grid.map(row => row.slice());
    const solutions = [];
    solverStartTime = Date.now();
    
    function findEmpty() {
        let bestCell = null;
        let minCandidates = 10;
        
        // MRV heuristic
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (copy[i][j] === 0) {
                    const candidates = getCandidates(copy, i, j);
                    if (candidates.length === 0) return null; // dead end
                    if (candidates.length < minCandidates) {
                        minCandidates = candidates.length;
                        bestCell = [i, j];
                        if (minCandidates === 1) break; 
                    }
                }
            }
        }
        return bestCell;
    }
    
    function solve() {
        if (Date.now() - solverStartTime > SOLVER_TIMEOUT) throw new Error("Solver timeout");
        
        const empty = findEmpty();
        if (!empty) {
            if (findAllSolutions) {
                solutions.push(copy.map(row => row.slice()));
                return solutions.length < maxSolutions;
            }
            return true;
        }
        
        const [row, col] = empty;
        const candidates = getCandidates(copy, row, col);
        
        for (const num of candidates) {
            copy[row][col] = num;
            if (solve()) {
                if (!findAllSolutions) return true;
            }
            copy[row][col] = 0;
        }
        return false;
    }
    
    try {
        if (findAllSolutions) {
            solve();
            return solutions.length > 0 ? solutions : null;
        } else {
            return solve() ? copy : null;
        }
    } catch (e) {
        return null; // timeout handles
    }
}

// --- Hint Techniques ---

function findNakedSingle(grid, candidates) {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (candidates[row][col].length === 1) {
                const num = candidates[row][col][0];
                return {
                    type: "naked_single",
                    row, col, value: num,
                    explanation: `<div class="hint-section"><span class="technique-name">Naked Single</span><br>At <strong>R${row + 1} C${col + 1}</strong>, only <strong>${num}</strong> is a valid candidate.</div>`
                };
            }
        }
    }
    return null;
}

function findHiddenSingle(grid, candidates) {
    // Row
    for (let row = 0; row < 9; row++) {
        for (let num = 1; num <= 9; num++) {
            const positions = [];
            for (let col = 0; col < 9; col++) {
                if (candidates[row][col].includes(num)) positions.push(col);
            }
            if (positions.length === 1) {
                return {
                    type: "hidden_single",
                    row, col: positions[0], value: num,
                    explanation: `<div class="hint-section"><span class="technique-name">Hidden Single (Row)</span><br>In Row ${row + 1}, <strong>${num}</strong> can only go in Column ${positions[0] + 1}.</div>`
                };
            }
        }
    }
    // Column
    for (let col = 0; col < 9; col++) {
        for (let num = 1; num <= 9; num++) {
            const positions = [];
            for (let row = 0; row < 9; row++) {
                if (candidates[row][col].includes(num)) positions.push(row);
            }
            if (positions.length === 1) {
                return {
                    type: "hidden_single",
                    row: positions[0], col, value: num,
                    explanation: `<div class="hint-section"><span class="technique-name">Hidden Single (Column)</span><br>In Column ${col + 1}, <strong>${num}</strong> can only go in Row ${positions[0] + 1}.</div>`
                };
            }
        }
    }
    // Box
    for (let boxRow = 0; boxRow < 3; boxRow++) {
        for (let boxCol = 0; boxCol < 3; boxCol++) {
            for (let num = 1; num <= 9; num++) {
                const positions = [];
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        const r = boxRow * 3 + i;
                        const c = boxCol * 3 + j;
                        if (candidates[r][c].includes(num)) positions.push({row: r, col: c});
                    }
                }
                if (positions.length === 1) {
                    const {row, col} = positions[0];
                    return {
                        type: "hidden_single",
                        row, col, value: num,
                        explanation: `<div class="hint-section"><span class="technique-name">Hidden Single (Box)</span><br>In the ${getBoxName(row, col)} box, <strong>${num}</strong> only fits in R${row + 1} C${col + 1}.</div>`
                    };
                }
            }
        }
    }
    return null;
}

function findPointingPair(grid, candidates) {
    for (let boxRow = 0; boxRow < 3; boxRow++) {
        for (let boxCol = 0; boxCol < 3; boxCol++) {
            for (let num = 1; num <= 9; num++) {
                const positions = [];
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        const r = boxRow * 3 + i;
                        const c = boxCol * 3 + j;
                        if (candidates[r][c].includes(num)) positions.push({row: r, col: c});
                    }
                }
                
                if (positions.length >= 2 && positions.length <= 3) {
                    const allSameRow = positions.every(p => p.row === positions[0].row);
                    const allSameCol = positions.every(p => p.col === positions[0].col);
                    
                    if (allSameRow) {
                        const row = positions[0].row;
                        const eliminations = [];
                        for (let col = 0; col < 9; col++) {
                            const inBox = col >= boxCol * 3 && col < boxCol * 3 + 3;
                            if (!inBox && candidates[row][col].includes(num)) {
                                eliminations.push({row, col});
                            }
                        }
                        if (eliminations.length > 0) {
                            return {
                                type: "pointing_pair",
                                positions,
                                value: num,
                                eliminations,
                                explanation: `<div class="hint-section"><span class="technique-name">Pointing Pair</span><br>In this box, <strong>${num}</strong> must be in Row ${row+1}. We can eliminate it from the rest of the row.</div>`
                            };
                        }
                    }
                    if (allSameCol) {
                        const col = positions[0].col;
                        const eliminations = [];
                        for (let row = 0; row < 9; row++) {
                            const inBox = row >= boxRow * 3 && row < boxRow * 3 + 3;
                            if (!inBox && candidates[row][col].includes(num)) {
                                eliminations.push({row, col});
                            }
                        }
                        if (eliminations.length > 0) {
                            return {
                                type: "pointing_pair",
                                positions,
                                value: num,
                                eliminations,
                                explanation: `<div class="hint-section"><span class="technique-name">Pointing Pair</span><br>In this box, <strong>${num}</strong> must be in Column ${col+1}. We can eliminate it from the rest of the column.</div>`
                            };
                        }
                    }
                }
            }
        }
    }
    return null;
}

function findXWing(grid, candidates) {
    // Simplified X-Wing Row Search
    for (let num = 1; num <= 9; num++) {
        const rowPositions = [];
        for (let row = 0; row < 9; row++) {
            const cols = [];
            for (let col = 0; col < 9; col++) {
                if (candidates[row][col].includes(num)) cols.push(col);
            }
            if (cols.length === 2) rowPositions.push({row, cols});
        }
        
        for (let i = 0; i < rowPositions.length; i++) {
            for (let j = i + 1; j < rowPositions.length; j++) {
                if (rowPositions[i].cols[0] === rowPositions[j].cols[0] && 
                    rowPositions[i].cols[1] === rowPositions[j].cols[1]) {
                        
                    const c1 = rowPositions[i].cols[0];
                    const c2 = rowPositions[i].cols[1];
                    const r1 = rowPositions[i].row;
                    const r2 = rowPositions[j].row; // error in original? 
                    
                    const eliminations = [];
                    for(let r = 0; r < 9; r++) {
                        if (r !== r1 && r !== rowPositions[j].row) {
                           if (candidates[r][c1].includes(num)) eliminations.push({row:r, col:c1});
                           if (candidates[r][c2].includes(num)) eliminations.push({row:r, col:c2});
                        }
                    }
                    if (eliminations.length > 0) {
                        return {
                            type: "x_wing",
                            positions: [{row:r1, col:c1}, {row:r1, col:c2}, {row:rowPositions[j].row, col:c1}, {row:rowPositions[j].row, col:c2}],
                            value: num,
                            eliminations,
                            explanation: `<div class="hint-section"><span class="technique-name">X-Wing</span><br>Number ${num} forms an X-Wing pattern in Rows ${r1+1} and ${rowPositions[j].row+1}. We can eliminate it from Columns ${c1+1} and ${c2+1}.</div>`
                        };
                    }
                }
            }
        }
    }
    return null;
}

// --- Main Action Handlers ---

function getNextHint() {
    const grid = getGrid();
    clearHighlights();

    const emptyCells = grid.flat().filter(c => c === 0).length;
    if (emptyCells === 0) {
        showMessage("The puzzle is complete! Use 'Check Rules' to verify.", "success");
        currentHint = null;
        return;
    }

    const cands = getAllCandidates(grid);
    
    // 1. Naked Single
    let hint = findNakedSingle(grid, cands);
    
    // 2. Hidden Single
    if (!hint) hint = findHiddenSingle(grid, cands);
    
    // 3. Pointing Pairs
    if (!hint) hint = findPointingPair(grid, cands);
    
    // 4. X-Wing
    if (!hint) hint = findXWing(grid, cands);

    if (hint) {
        currentHint = hint;
        showMessage(hint.explanation);
        
        // Highlight logic
        if (hint.type.includes("single")) {
             highlightCell(hint.row, hint.col, "hint");
        } else if (hint.positions) {
             hint.positions.forEach(p => highlightCell(p.row, p.col, "hint"));
        }
        
        if (hint.eliminations) {
             hint.eliminations.forEach(e => highlightCell(e.row, e.col, "related"));
        }
    } else {
        currentHint = null;
        showMessage("No advanced technique found. Try guessing or checking candidates.", "info");
    }
}

function applyHint() {
  if (!currentHint) {
    showMessage("No hint to apply. Click 'Get Next Hint' first.", "error");
    return;
  }
  
  if (currentHint.type.includes("single")) {
     const input = document.querySelector(`input[data-row="${currentHint.row}"][data-col="${currentHint.col}"]`);
     input.value = currentHint.value;
     input.classList.add("solved", "pop-in");
     showMessage(`Applied: ${currentHint.value}`, "success");
     currentHint = null;
     clearHighlights();
  } else {
     showMessage("This is an elimination hint. Mentally remove the highlighted candidates.", "info");
  }
}

function highlightCell(row, col, type) {
  const input = document.querySelector(`input[data-row="${row}"][data-col="${col}"]`);
  if (input) {
    input.classList.remove("hint", "related", "incorrect");
    input.classList.add(type);
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function clearHighlights() {
  document.querySelectorAll("input").forEach(input => {
    input.classList.remove("hint", "related", "incorrect");
  });
}

function checkRules() {
    const grid = getGrid();
    let errors = [];
    clearHighlights();
    
    // Check Rows
    for(let i=0; i<9; i++) {
        const seen = new Map();
        for(let j=0; j<9; j++) {
             const val = grid[i][j];
             if(val > 0) {
                 if(seen.has(val)) {
                     errors.push({r:i, c:j}); 
                     errors.push({r:i, c:seen.get(val)});
                 }
                 seen.set(val, j);
             }
        }
    }
    
    // Check Cols
    for(let j=0; j<9; j++) {
        const seen = new Map();
        for(let i=0; i<9; i++) {
             const val = grid[i][j];
             if(val > 0) {
                 if(seen.has(val)) {
                     errors.push({r:i, c:j}); 
                     errors.push({r:seen.get(val), c:j});
                 }
                 seen.set(val, i);
             }
        }
    }
    
    // Check Boxes
    for(let br=0; br<3; br++) {
        for(let bc=0; bc<3; bc++) {
            const seen = new Map();
            for(let i=0; i<3; i++) {
                for(let j=0; j<3; j++) {
                    const r = br*3+i;
                    const c = bc*3+j;
                    const val = grid[r][c];
                    if(val>0) {
                        if(seen.has(val)) {
                            errors.push({r, c});
                            const prev = seen.get(val);
                            errors.push({r:prev.r, c:prev.c});
                        }
                        seen.set(val, {r, c});
                    }
                }
            }
        }
    }
    
    if(errors.length > 0) {
        errors.forEach(e => highlightCell(e.r, e.c, "incorrect"));
        showMessage("Rule violations found! (See red cells)", "error");
    } else {
        showMessage("No rule violations found.", "success");
    }
}

function checkSolution() {
    clearHighlights();
    if (!originalPuzzle) {
        const grid = getGrid();
        const emptyCells = grid.flat().filter(c => c === 0).length;
        if(emptyCells > 64) { // Only <17 clues
             showMessage("Not enough clues to verify a unique solution. Enter more numbers or 'Lock Clues'.", "error");
             return;
        }
        // Try to solve broadly
        const sol = solvePuzzle(grid);
        if(!sol) showMessage("No solution exists for this configuration.", "error");
        else showMessage("The current configuration is valid and solvable.", "success");
        return;
    }
    
    // Compare against locked puzzle solution
    const solution = solvePuzzle(originalPuzzle);
    if (!solution) {
        showMessage("The original locked puzzle has no solution.", "error");
        return;
    }
    
    const grid = getGrid();
    let incorrect = 0;
    for(let i=0; i<9; i++) {
        for(let j=0; j<9; j++) {
            if(grid[i][j] > 0 && grid[i][j] !== solution[i][j]) {
                highlightCell(i, j, "incorrect");
                incorrect++;
            }
        }
    }
    
    if(incorrect > 0) showMessage(`${incorrect} incorrect cells found.`, "error");
    else {
        const empty = grid.flat().filter(c => c === 0).length;
        if(empty === 0) showMessage("Congratulations! Puzzle Solved!", "success");
        else showMessage("Everything looks correct so far.", "success");
    }
}

function lockPuzzle() {
    const grid = getGrid();
    const filled = grid.flat().filter(c=>c>0).length;
    if(filled < 17) {
        showMessage("Need at least 17 clues to lock a valid Sudoku.", "error");
        return;
    }
    if(!solvePuzzle(grid)) {
         showMessage("This config has no solution. Cannot lock.", "error");
         return;
    }
    
    originalPuzzle = grid.map(r => r.slice());
    document.querySelectorAll("input").forEach(input => {
        if(input.value) {
            input.classList.add("locked");
            input.readOnly = true;
        }
    });
    showMessage("Puzzle locked. Clues protected.", "success");
}

function clearGrid() {
    document.querySelectorAll("input").forEach(input => {
        input.value = "";
        input.classList.remove("locked", "solved", "hint", "incorrect", "related");
        input.readOnly = false;
        input.parentElement.classList.remove('focused-cell-group');
    });
    document.querySelectorAll(".candidates").forEach(e => e.remove());
    originalPuzzle = null;
    currentHint = null;
    
    const url = new URL(window.location);
    url.searchParams.delete('puzzle');
    window.history.replaceState({}, '', url);
    
    showMessage("Grid cleared. Start fresh!");
}

function handleImage(file) {
    // Keeping simple for now
    if(file.size > 2*1024*1024) { showMessage("Image too large (>2MB)", "error"); return; }
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById("uploadedImage").src = e.target.result;
        document.getElementById("uploadedImage").style.display = "block";
    };
    reader.readAsDataURL(file);
}

// --- Import/Export/Share ---

function exportGrid() {
    const grid = getGrid();
    let txt = "";
    for(let r of grid) txt += r.map(c => c || ".").join("") + "\n";
    
    const blob = new Blob([txt], {type:"text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sudoku-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    showMessage("Puzzle exported.");
}

function handleImport(file) {
    if(!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const content = e.target.result;
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if(lines.length !== 9) { showMessage("Invalid file format", "error"); return; }
        
        const grid = Array(9).fill().map(() => Array(9).fill(0));
        lines.forEach((line, r) => {
             for(let c=0; c<9 && c<line.length; c++) {
                 const char = line[c];
                 if("123456789".includes(char)) grid[r][c] = parseInt(char);
             }
        });
        setGrid(grid);
        showMessage("Puzzle imported.");
    };
    reader.readAsText(file);
}

function shareViaURL() {
    const grid = getGrid();
    const str = grid.map(r=>r.map(c=>c||0).join("")).join("");
    const compressed = btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const url = new URL(window.location.href);
    url.searchParams.set('puzzle', compressed);
    
    navigator.clipboard.writeText(url.toString())
        .then(() => showMessage("Link copied to clipboard!", "success"))
        .catch(() => showMessage("Could not copy link. Check console for URL.", "error"));
}

function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('puzzle');
    if(p) {
        try {
            const str = atob(p.replace(/-/g, '+').replace(/_/g, '/'));
            if(str.length === 81) {
                const grid = [];
                for(let i=0; i<9; i++) {
                    const row = [];
                    for(let j=0; j<9; j++) {
                        const val = parseInt(str[i*9+j]);
                        row.push(isNaN(val)?0:val);
                    }
                    grid.push(row);
                }
                setGrid(grid);
                showMessage("Loaded puzzle from URL.", "success");
            }
        } catch(e) {
            console.error(e);
        }
    }
}
