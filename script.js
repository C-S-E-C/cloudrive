// sha512 hash function
async function sha512(str) {
    // 将字符串编码为 Uint8Array
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    
    // 使用 Web Crypto API 计算哈希
    const hashBuffer = await crypto.subtle.digest('SHA-512', data);
    
    // 将 ArrayBuffer 转换为十六进制字符串
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
}

async function signup() {
    var username = document.getElementById("username").value;
    var email = document.getElementById("email").value;
    var password = document.getElementById("password").value;
    password = await sha512(password)+await sha512(password.split("").reverse().join(""));
    var data = new URLSearchParams({email: email, username: username, password: password});
    let response = await fetch('https://api.cloudrive.csec.top/register', {
        method: 'POST',
        headers: {
           'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: data
    });
    let json = await response.json();
    if (json.success) {
        localStorage.setItem("userid", json.userid);
        localStorage.setItem("password", password);
        alert("Account created successfully!");
        window.location.href = "login.html";
    }
}