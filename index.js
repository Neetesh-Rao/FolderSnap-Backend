// 1. Express import kar rahe hain — yeh hamara server banayega
// Bina express ke HTTP requests handle nahi ho sakti
const express = require('express');

// 2. Multer import kar rahe hain — file upload handle karta hai
// Jab Postman se image bhejte hain — multer usse pakadta hai
const multer = require('multer');

// 3. CORS import kar rahe hain
// VS Code Extension alag port pe hogi — cors unhe baat karne deta hai
// Bina cors ke "blocked by browser" error aata hai
const cors = require('cors');

// 4. Dotenv import kar rahe hain
// Yeh .env file se API key padhta hai
// Bina dotenv ke process.env.OPENROUTER_API_KEY undefined hoga
const dotenv = require('dotenv');

// 5. OpenAI package import kar rahe hain
// OpenRouter ka API format exactly OpenAI jaisa hai
// Isliye alag package nahi — same kaam karta hai
const OpenAI = require('openai');

// 6. fs — File System module
// Yeh Node.js built-in hai — install nahi karna
// Image padhne ke liye, delete karne ke liye use hoga
const fs = require('fs');

// 7. path — Path module
// Yeh bhi Node.js built-in hai
// File paths properly banane ke liye — Windows/Mac dono pe kaam kare
const path = require('path');

// 8. .env file load kar rahe hain
// Iske baad process.env.OPENROUTER_API_KEY available ho jaayegi
// Yeh line sabse pehle honi chahiye — baaki sab iske baad
dotenv.config();

// 9. Express app bana rahe hain
// app — yahi hamara poora server hai
// Isi pe routes, middleware sab lagayenge
const app = express();

// 10. CORS middleware lagao
// Har request pe automatically CORS headers add honge
// VS Code Extension ko backend se baat karne ki permission milegi
app.use(cors());

// 11. JSON body parser lagao
// Agar koi JSON body bheje request mein — yeh parse kar dega
// req.body available ho jaayega
app.use(express.json());

// 12. OpenRouter client banao
// baseURL — OpenRouter ka API endpoint
// apiKey — .env se aa rahi hai — directly code mein nahi likhi
// Yeh client baad mein API call karne ke kaam aayega
const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY
});

// 13. Multer storage configure kar rahe hain
// Yeh batata hai — uploaded image kahan save ho aur kya naam mile
const storage = multer.diskStorage({
  
  // 14. destination — image kahan save hogi
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    
    // 15. Agar uploads/ folder exist nahi karta — banao
    // Pehli baar run karne pe yeh folder nahi hoga
    // fs.existsSync — check karta hai folder hai ya nahi
    // fs.mkdirSync — folder banata hai
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    
    // 16. cb — callback function
    // null — koi error nahi
    // uploadDir — yahan save karo
    cb(null, uploadDir);
  },

  // 17. filename — image ka naam kya hoga
  filename: function (req, file, cb) {
    // 18. Date.now() — current timestamp milliseconds mein
    // Kyun timestamp: agar 2 log saath upload karein — conflict na ho
    // Example: 1234567890-myphoto.png
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// 19. File filter — sirf images allow karo
// PDF, video, text files reject ho jaayengi
const fileFilter = (req, file, cb) => {
  // 20. mimetype check karo — image/png, image/jpeg etc.
  // startsWith('image/') — koi bhi image type allow karo
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);  // allow karo
  } else {
    cb(new Error('Sirf image files allowed hain'), false); // reject karo
  }
};

// 21. Multer final setup — storage + filter + size limit
const upload = multer({
  storage: storage,       // upar wala storage config
  fileFilter: fileFilter, // upar wala filter
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB max
    // 10 * 1024 * 1024 = 10,485,760 bytes = 10MB
    // Zyada badi image Gemini/OpenRouter handle nahi kar sakta
  }
});

// 22. Helper function — image ko base64 mein convert karo
// OpenRouter image directly nahi leta — base64 string chahiye
// base64 — binary data ko text mein convert karna
function imageToBase64(imagePath) {
  // 23. Image file padhlo — binary buffer mein
  const imageBuffer = fs.readFileSync(imagePath);
  
  // 24. Buffer ko base64 string mein convert karo
  // toString('base64') — binary → readable text string
  return imageBuffer.toString('base64');
}

// 25. Helper function — AI ka response clean karo
// AI kabhi kabhi JSON ke saath extra text deta hai
// Jaise: ```json { ... } ``` — yeh backticks hataane hain
function cleanJsonResponse(text) {
  // 26. Regex se backticks aur "json" word hataao
  // /```json\n?/g — ```json dhundho aur hataao
  // /```\n?/g — baaki backticks bhi hataao
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  
  // 27. trim() — aage peeche ke spaces hataao
  return cleaned.trim();
}

// 28. Main route — POST /analyze
// Yahan image aayegi — process hogi — JSON wapas jaayega
// upload.single('image') — ek image expect karo — 'image' key se
app.post('/analyze', upload.single('image'), async (req, res) => {

  // 29. Check karo — image aayi ya nahi
  // req.file — multer yahan uploaded file rakhta hai
  if (!req.file) {
    return res.status(400).json({ error: 'Koi image nahi mili' });
  }

  // 30. Image ka temporary path save karo
  // Baad mein delete karne ke kaam aayega
  const imagePath = req.file.path;

  try {
    // 31. Image ko base64 mein convert karo
    const base64Image = imageToBase64(imagePath);
    
    // 32. Image ka type lo — image/png ya image/jpeg
    const mimeType = req.file.mimetype;

    // 33. OpenRouter API call karo
    // chat.completions.create — message bhejo AI ko
    const response = await client.chat.completions.create({
      
      // 34. Free model use kar rahe hain
      // meta-llama/llama-4-scout:free — vision support hai, free hai
      // :free — yeh batata hai free tier use karo
     model: 'openrouter/auto',
      messages: [
        {
          role: 'user', // user ki taraf se message
          content: [
            
            // 35. Image content — base64 format mein
            {
              type: 'image_url',
              image_url: {
                // 36. data URL format — browser jaisa
                // data:image/png;base64,iVBORw0K...
                // AI isko image ki tarah padhta hai
                url: `data:${mimeType};base64,${base64Image}`
              }
            },
            
            // 37. Text prompt — AI ko instructions
            {
              type: 'text',
              text: `Tu ek folder structure analyzer hai.
Is image mein jo bhi folder/file structure dikha raha hai usse
exactly JSON format mein de.

Rules:
- Folders ke andar objects honge
- Files ke liye null value hogi
- Sirf JSON de — koi explanation nahi
- Agar image mein koi structure nahi hai toh {} de

Example output:
{
  "src": {
    "components": {
      "Header.jsx": null,
      "Footer.jsx": null
    },
    "pages": {
      "Home.jsx": null
    },
    "index.js": null
  },
  "package.json": null
}`
            }
          ]
        }
      ]
    });

    // 38. AI ka response text nikalo
    // response.choices[0] — pehla response
    // .message.content — actual text
    const responseText = response.choices[0].message.content;
    
    // 39. JSON clean karo — backticks hataao
    const cleanedResponse = cleanJsonResponse(responseText);
    
    // 40. String ko actual JSON object mein convert karo
    // JSON.parse — string → JavaScript object
    const folderStructure = JSON.parse(cleanedResponse);

    // 41. Temporary image delete karo — kaam ho gaya
    // Disk space waste na ho — har request ke baad clean karo
    fs.unlinkSync(imagePath);

    // 42. VS Code Extension ko response bhejo
    // success: true — sab theek hua
    // structure — folder ka JSON
    res.json({
      success: true,
      structure: folderStructure
    });

  } catch (error) {
    // 43. Kuch bhi galat hua — yahan aayega
    console.error('Error:', error.message);
    
    // 44. Temporary file delete karo — error pe bhi
    // Agar delete nahi kiya — uploads/ folder bhar jaayega
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // 45. Error response bhejo
    // 500 — server error
    res.status(500).json({
      error: 'Kuch galat hua',
      details: error.message
    });
  }
});

// 46. Health check route
// Bas check karne ke liye — server chal raha hai ya nahi
// Browser mein /health kholo — seedha pata chal jaayega
app.get('/health', (req, res) => {
  res.json({ status: 'Server chal raha hai' });
});

// 47. Server start karo
// PORT — .env se lo, nahi hai toh 3000 use karo
const PORT = process.env.PORT || 3000;

// 48. app.listen — server ko port pe sunne ke liye lagao
// Callback — jab server ready ho — console mein print karo
app.listen(PORT, () => {
  console.log(`Server chal raha hai port ${PORT} pe`);
});