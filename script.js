const API_BASE = 'https://api.cloudrive.csec.top';

// --- Your Custom Dual SHA-512 Hashing Logic ---
async function sha512(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-512', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getClientHash(password) {
    // Logic: sha512(pass) + sha512(reversed pass)
    const forwardHash = await sha512(password);
    const reversedPass = password.split("").reverse().join("");
    const backwardHash = await sha512(reversedPass);
    
    return forwardHash + backwardHash;
}

// --- Auth Handling ---
if (document.getElementById('signupForm')) {
    document.getElementById('signupForm').onsubmit = async (e) => {
        e.preventDefault();
        const rawPassword = document.getElementById('password').value;
        const customHash = await getClientHash(rawPassword);
        
        const params = new URLSearchParams({
            username: document.getElementById('username').value,
            email: document.getElementById('email').value,
            password: customHash, // Sending the dual-hash string
            previewcode: document.getElementById('previewcode').value
        });

        const res = await fetch(`${API_BASE}/register`, { method: 'POST', body: params });
        const data = await res.json();
        if (data.success) {
            alert('Registered successfully!');
            window.location.href = 'login.html';
        } else {
            alert('Registration failed: ' + data.error);
        }
    };
}

if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').onsubmit = async (e) => {
        e.preventDefault();
        const iden = document.getElementById('identifier').value;
        const rawPassword = document.getElementById('password').value;
        const customHash = await getClientHash(rawPassword);
        
        const params = new URLSearchParams({ password: customHash });
        if (iden.includes('@')) {
            params.append('email', iden);
        } else {
            params.append('username', iden);
        }

        const res = await fetch(`${API_BASE}/login`, { method: 'POST', body: params });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('userid', data.userid);
            localStorage.setItem('username', data.username);
            localStorage.setItem('pass_hash', customHash); // Store the hash for action verification
            window.location.href = 'dashboard.html';
        } else {
            alert('Login failed: ' + data.error);
        }
    };
}

// --- Dashboard & Action Functions ---
async function loadFiles() {
    const userid = localStorage.getItem('userid');
    const password = localStorage.getItem('pass_hash');
    if (!userid) return;

    const params = new URLSearchParams({ userid, password, path: "" });
    const res = await fetch(`${API_BASE}/action/list`, { method: 'POST', body: params });
    const result = await res.json();

    const container = document.getElementById('fileList');
    if (result.success && result.data) {
        container.innerHTML = result.data.map(file => {
            const fileName = file.key.replace(userid + '/', '');
            if (!fileName) return ''; // Skip the directory placeholder
            return `
                <tr class="border-b hover:bg-gray-50">
                    <td class="p-4">${fileName}</td>
                    <td class="p-4 text-right">
                        <button onclick="deleteFile('${fileName}')" class="text-red-600 hover:underline">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

async function createFile(filename, content) {
    const name = filename;
    const userid = localStorage.getItem('userid');
    const password = localStorage.getItem('pass_hash');
    
    if (!name) return alert("Enter a filename");

    // 1. Open the PiP Window
    const pipWindow = await window.documentPictureInPicture.requestWindow({ width: 500, height: 300 });
    const pipDoc = pipWindow.document;

    // 2. Load the animation HTML into the PiP document
    const animationHtml = await (await fetch("send_animation.html")).text();
    pipDoc.body.innerHTML = animationHtml;

    // 3. Select elements FROM the PiP document
    const statusbar = pipDoc.getElementById("status");
    const circle = pipDoc.getElementById("computer_circle");
    const servCircle = pipDoc.getElementById("server_circle");
    
    // UI Elements for final transition
    const compWrap = pipDoc.getElementById("computer_wrapper");
    const servWrap = pipDoc.getElementById("server_wrapper");
    const serverIcon = pipDoc.querySelector('.server-icon');
    const check = pipDoc.getElementById("checkmark");

    statusbar.innerText = "Analyzing data...";

    const params = new URLSearchParams({ 
        userid, 
        password, 
        path: name, 
        content: content 
    });

    // 4. Start Upload UI
    statusbar.innerText = "Data Uploading...";
    circle.style.borderBottomColor = "#078b07";
    circle.style.animation = "bigger 3s forwards";

    // Start request and animation delay in parallel
    const animationDelay = new Promise(resolve => setTimeout(resolve, 250));

    await animationDelay;
    const fetchevent = fetch(`${API_BASE}/action/create`, { method: 'POST', body: params });
    // Update Server Circle animation
    servCircle.style.borderColor = "#078b07";
    servCircle.style.borderBottomColor = "transparent";
    servCircle.style.animation = "rotate 2.5s linear infinite";

    try {
        const res = await fetchevent;
        const data = await res.json();

        if (data.success) {
            // 5. Success State Transitions
            compWrap.className = "container fade-out";
            servWrap.className = "container center-and-scale";

            servCircle.style.animation = "none";
            servCircle.style.borderBottomColor = "#078b07"; 
            servCircle.style.borderColor = "#078b07"; 

            if (serverIcon) {
                serverIcon.style.opacity = '0';
                serverIcon.style.transition = 'opacity 0.5s';
            }

            check.style.animation = "showCheck 0.5s forwards 0.5s";
            check.style.borderColor = "#078b07"; 
            
            statusbar.innerText = "Success!";
            
            // Cleanup main UI
            const inputField = document.getElementById('newFileName');
            if (inputField) inputField.value = '';
            loadFiles();

            // Wait before closing
            await new Promise(resolve => setTimeout(resolve, 1500));
            pipWindow.close();
        } else {
            statusbar.innerText = "Error!";
            alert('Upload failed: ' + data.error);
            pipWindow.close();
        }
    } catch (err) {
        console.error(err);
        pipWindow.close();
    }
}

async function deleteFile(fileName) {
    const userid = localStorage.getItem('userid');
    const password = localStorage.getItem('pass_hash');
    
    const params = new URLSearchParams({ userid, password, path: fileName });
    const res = await fetch(`${API_BASE}/action/delete`, { method: 'POST', body: params });
    const data = await res.json();
    if (data.success) loadFiles();
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

// Init Dashboard
if (document.getElementById('fileList')) {
    document.getElementById('userNameDisplay').innerText = localStorage.getItem('username') || 'User';
    loadFiles();
}
// --- Share Modal Logic ---
function openShareModal() {
    const selected = document.querySelectorAll('.file-checkbox:checked');
    if (selected.length === 0) return alert("Select at least one file to share.");
    document.getElementById('shareModal').classList.remove('hidden');
}

function closeShareModal() {
    document.getElementById('shareModal').classList.add('hidden');
    document.getElementById('shareModal').innerHTML=`<div class="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
                    </svg>
                </div>
                <h3 class="text-2xl font-bold text-gray-800">Create Share Link</h3>
                <p class="text-gray-500 text-sm mt-1">Configure security for selected files</p>
            </div>

            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">Passphrase (Required)</label>
                    <input type="password" id="sharePass" placeholder="Enter a password" class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">Expires After</label>
                    <select id="shareExpiry" class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white">
                        <option value="3600">1 Hour</option>
                        <option value="86400" selected="">24 Hours</option>
                        <option value="604800">7 Days</option>
                    </select>
                </div>
            </div>

            <div class="flex gap-3 mt-8">
                <button onclick="closeShareModal()" class="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl transition">Cancel</button>
                <button onclick="confirmShare()" class="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition">Generate Link</button>
            </div>
        </div>
    `
}

async function confirmShare() {
    const sharePassword = document.getElementById('sharePass').value || null;
    const expiration = document.getElementById('shareExpiry').value;
    const userid = localStorage.getItem('userid');
    const userpassword = localStorage.getItem('pass_hash');
    
    const selectedCheckboxes = document.querySelectorAll('.file-checkbox:checked');
    const filesToShare = Array.from(selectedCheckboxes).map(cb => cb.value);

    if (filesToShare.length === 0) return alert("No files selected");

    const params = new URLSearchParams();
    params.append('userid', userid);
    params.append('userpassword', userpassword);
    params.append('password', sharePassword);
    params.append('expiration', expiration);
    
    // Add each file individually so the backend can use params.getAll('files')
    filesToShare.forEach(file => params.append('files', file));

    try {
        const res = await fetch(`${API_BASE}/share/create`, {
            method: 'POST',
            body: params.toString(), // Explicitly send as string
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        const data = await res.json();
        if (data.success) {
            // Provide the user with the ID and password
            // alert(`Share Created!\nID: ${data.shareId}\nPassword: ${sharePassword}`);
             document.getElementsByClassName('bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full')[0].innerHTML=`
    <div class="text-center">
        <div class="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="C5 13l4 4L19 7" />
            </svg>
        </div>
        <h3 class="text-xl font-bold text-gray-800 mb-6">Link Created Successfully</h3>
        
        <div class="space-y-4 text-left">
            <div>
                <label class="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Share ID</label>
                <div class="flex mt-1">
                    <input type="text" readonly value="${data.shareId}" 
                           class="w-full bg-gray-50 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm font-mono focus:outline-none">
                </div>
            </div>

            <div>
                <label class="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
                <div class="flex mt-1">
                    <input type="text" readonly value="${sharePassword}" 
                           class="w-full bg-gray-50 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm font-mono focus:outline-none">
                </div>
            </div>
        </div>

        <div class="mt-8 flex flex-col gap-2">
            <button onclick="copyToClipboard('https://cloudrive.csec.top/shared_files.html?id=${data.shareId}')" 
                    class="w-full py-3 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition flex items-center justify-center gap-2">
                <span>Copy Link (No Password)</span>
            </button>
            
            <button onclick="copyToClipboard('https://cloudrive.csec.top/shared_files.html?id=${data.shareId}&pwd=${sharePassword}')" 
                    class="w-full py-3 border-2 border-purple-600 text-purple-600 text-sm font-bold rounded-xl hover:bg-purple-50 transition">
                Copy Link + Password
            </button>
            
            <button onclick="closeShareModal()" 
                    class="mt-2 py-2 text-gray-400 text-sm font-medium hover:text-gray-600 transition">
                Close
            </button>
        </div>
    </div>
`;
        } else {
            alert("Error: " + data.error);
        }
    } catch (e) {
        alert("Server error. Check worker logs.");
        console.error(e);
    }
}
// --- Update loadFiles to include Checkboxes ---
async function loadFiles() {
    const userid = localStorage.getItem('userid');
    const password = localStorage.getItem('pass_hash');
    if (!userid) return;

    const params = new URLSearchParams({ userid, password, path: "" });
    const res = await fetch(`${API_BASE}/action/list`, { method: 'POST', body: params });
    const result = await res.json();

    const container = document.getElementById('fileList');
    if (result.success && result.data) {
        container.innerHTML = result.data.map(file => {
            const fileName = file.key.replace(userid + '/', '');
            if (!fileName || fileName === "") return ''; 
            
            return `
                <tr class="border-b hover:bg-gray-50">
                    <td class="p-4 w-10">
                        <input type="checkbox" class="file-checkbox" value="${fileName}">
                    </td>
                    <td class="p-4 font-medium">${fileName}</td>
                    <td class="p-4 text-right">
                        <button onclick="deleteFile('${fileName}')" class="text-red-500 hover:text-red-700 text-sm">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

// Add this to your script.js if not already present
async function loadSharedFiles() {
    const id = document.getElementById('shareId').value;
    const password = document.getElementById('sharePassword').value;
    const listContainer = document.getElementById('sharedList');

    if (!id) return alert("Please enter a Share ID");

    try {
        const params = new URLSearchParams({ id, password });
        const res = await fetch(`${API_BASE}/share/list`, { 
            method: 'POST', 
            body: params.toString() 
        });
        
        const data = await res.json();
        
        if (data.success) {
            // Hide the access form or just clear the list
            listContainer.innerHTML = '';
            
            if (data.data.length === 0) {
                listContainer.innerHTML = '<p class="text-center text-gray-400">This share is empty.</p>';
                return;
            }

            data.data.forEach(fullPath => {
                // The backend returns full paths (e.g., "shareid/filename.txt")
                // We strip the ID for a cleaner UI
                const fileName = fullPath.split('/').slice(1).join('/');
                if (!fileName) return; // Skip the directory marker
                const fileDiv = document.createElement('div');
                fileDiv.className = "bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm";
                fileDiv.innerHTML = `
                    <span class="font-medium text-gray-700">${fileName}</span>
                    <a href="${data.url_prefix}${fullPath}" 
                       target="_blank" 
                       download="${fileName}"
                       class="text-blue-600 font-bold text-sm hover:underline">
                       Download
                    </a>
                `;
                listContainer.appendChild(fileDiv);
            });
        } else {
            alert("Access Denied: " + data.error);
        }
    } catch (e) {
        console.error(e);
        alert("Failed to connect to the server.");
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Optional: show a small toast or change button text temporarily
        alert("Copied to clipboard!");
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

function createFileWindow(filename=""){
    const PiP = window.documentPictureInPicture.requestWindow({width:500,height:300});
    const pipDoc = PiP.document;
    pipDoc.body.innerHTML = `<div id="top" style="display: inline-flex; top:1%; left:1%; position: absolute; width: 98%; height: 5%;">
    <input type="text" id="filename" style="width: 85%;" placeholder="file.txt"  />
    <p style="line-height: 90%;width: 2.5%;">&nbsp;&nbsp;</p>
    <button id="saveBtn" style="width: 5%;" onclick="pipsave()">Save</button>
    <p style="line-height: 90%;width: 2.5%;">&nbsp;&nbsp;</p>
    <button id="cancelBtn" style="width: 5%;" onclick="document.close()">Cancel</button>
</div>
<div id="editor" style="top:7%; left:1%; position: absolute; width: 98%; height: 89%; display: flex;">
    <textarea id="text" style="width: 100%; height: 100%;"></textarea>
</div>
<script>
    function pipsave(){
        var filename = document.getElementById("filename").value;
        var text = document.getElementById("text").value;
        createFile(filename, text);
        document.close();
    }
</script>`;
    pipDoc.getElementById("filename").value = filename;
}