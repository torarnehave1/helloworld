<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()

// API endpoint for image uploads (shared Vegvisr R2 bucket)
const UPLOAD_API = 'https://api.vegvisr.org/upload'

// State
const title = ref('My Document')
const content = ref(`# Hello Vegvisr

Write your markdown content here.

## Features
- **Bold** and *italic* text
- Lists and bullet points
- Code blocks
- Images (click the image button below)

\`\`\`javascript
console.log('Hello from the Knowledge Graph!')
\`\`\`

---

Add your own content above!
`)
const saving = ref(false)
const result = ref(null)
const error = ref('')
const uploading = ref(false)
const textareaRef = ref(null)

// Core function to upload a file and insert markdown image at cursor
async function uploadAndInsertImage(file, altTextOverride = null) {
  if (!file.type.startsWith('image/')) {
    error.value = 'Please select a valid image file'
    return
  }

  uploading.value = true
  error.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(UPLOAD_API, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error('Failed to upload image')
    }

    const data = await response.json()
    const imageUrl = data.url

    // Insert markdown image at cursor position
    const textarea = textareaRef.value
    const altText = altTextOverride || file.name.replace(/\.[^/.]+$/, '') || 'pasted-image'
    const markdownImage = `![${altText}](${imageUrl})`

    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const before = content.value.substring(0, start)
      const after = content.value.substring(end)
      content.value = before + markdownImage + '\n' + after

      // Move cursor after inserted image
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + markdownImage.length + 1
        textarea.focus()
      }, 0)
    } else {
      // Fallback: append to end
      content.value += '\n' + markdownImage + '\n'
    }
  } catch (e) {
    error.value = 'Failed to upload image. Please try again.'
    console.error('Upload error:', e)
  } finally {
    uploading.value = false
  }
}

// File input handler - uses the shared upload function
async function handleImageUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return

  await uploadAndInsertImage(file)
  // Reset file input
  event.target.value = ''
}

// Paste handler - intercepts image paste and uploads
async function handlePaste(event) {
  const items = event.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault() // Prevent default paste behavior
      const file = item.getAsFile()
      if (file) {
        // Generate a timestamp-based alt text for pasted images
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
        await uploadAndInsertImage(file, `image-${timestamp}`)
      }
      return // Only handle the first image
    }
  }
  // If no image found, let the default paste behavior handle text
}

async function saveToKnowledgeGraph() {
  if (!title.value.trim()) {
    error.value = 'Please enter a title'
    return
  }
  if (!content.value.trim()) {
    error.value = 'Please enter some content'
    return
  }

  saving.value = true
  result.value = null
  error.value = ''

  try {
    const response = await fetch('/api/save-hello', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: title.value,
        content: content.value,
        email: userStore.email
      })
    })

    const data = await response.json()

    if (response.ok) {
      result.value = data
    } else {
      error.value = data.error || 'Failed to save to Knowledge Graph'
    }
  } catch (e) {
    error.value = 'Network error. Please try again.'
    console.error('Save error:', e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="main-view">
    <div class="welcome-card">
      <h1>Welcome to Hello Vegvisr!</h1>
      <p class="welcome-text">
        You're logged in as <strong>{{ userStore.email }}</strong>
        <span v-if="userStore.role" class="role-badge">{{ userStore.role }}</span>
      </p>
    </div>

    <div class="action-card">
      <h2>Create a Markdown Document</h2>
      <p class="description">
        Write your content in Markdown format and save it to the Vegvisr Knowledge Graph.
      </p>

      <div class="form-group">
        <label for="title">Document Title</label>
        <input
          id="title"
          v-model="title"
          type="text"
          placeholder="Enter document title..."
          :disabled="saving"
        />
      </div>

      <div class="form-group">
        <label for="content">Content (Markdown)</label>
        <div class="textarea-toolbar">
          <input
            type="file"
            ref="fileInputRef"
            accept="image/*"
            @change="handleImageUpload"
            style="display: none"
          />
          <button
            type="button"
            class="toolbar-btn"
            @click="$refs.fileInputRef.click()"
            :disabled="uploading || saving"
            title="Upload image"
          >
            {{ uploading ? 'Uploading...' : 'Add Image' }}
          </button>
        </div>
        <textarea
          id="content"
          ref="textareaRef"
          v-model="content"
          placeholder="Write your markdown content here..."
          :disabled="saving || uploading"
          rows="15"
          @paste="handlePaste"
        ></textarea>
        <p class="hint">Supports Markdown: **bold**, *italic*, # headings, - lists, ```code blocks```, ![alt](url) for images. Paste images directly!</p>
      </div>

      <button @click="saveToKnowledgeGraph" :disabled="saving" class="save-btn">
        {{ saving ? 'Saving...' : 'Save to Knowledge Graph' }}
      </button>

      <div v-if="error" class="message error">{{ error }}</div>

      <div v-if="result" class="result-card">
        <h3>Saved Successfully!</h3>
        <div class="result-details">
          <div class="result-row">
            <span class="label">Graph ID:</span>
            <code>{{ result.graphId }}</code>
          </div>
          <div class="result-row" v-if="result.nodeId">
            <span class="label">Node ID:</span>
            <code>{{ result.nodeId }}</code>
          </div>
        </div>
      </div>
    </div>

    <div class="info-card">
      <h3>About This App</h3>
      <p>
        This is a Hello Vegvisr demonstration app integrated with the Vegvisr ecosystem.
        It showcases:
      </p>
      <ul>
        <li>Magic link authentication</li>
        <li>User session management</li>
        <li>Knowledge Graph integration</li>
        <li>Image upload to R2 (via api.vegvisr.org)</li>
        <li>Cloudflare Workers API</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.main-view {
  max-width: 600px;
  margin: 0 auto;
}

.welcome-card,
.action-card,
.info-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.welcome-card {
  text-align: center;
  background: linear-gradient(135deg, #4f6d7a 0%, #5a7d8a 100%);
  color: white;
}

.welcome-card h1 {
  font-size: 1.75rem;
  margin-bottom: 10px;
}

.welcome-text {
  font-size: 1rem;
  opacity: 0.95;
}

.welcome-text strong {
  font-weight: 600;
}

.role-badge {
  display: inline-block;
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.8rem;
  margin-left: 10px;
}

.action-card h2 {
  color: #333;
  font-size: 1.25rem;
  margin-bottom: 10px;
}

.description {
  color: #666;
  margin-bottom: 20px;
  font-size: 0.95rem;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #333;
  font-weight: 500;
  font-size: 0.9rem;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #4f6d7a;
}

.form-group input:disabled,
.form-group textarea:disabled {
  background: #f5f5f5;
}

.form-group textarea {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  line-height: 1.5;
  resize: vertical;
  min-height: 200px;
  transition: border-color 0.2s;
}

.form-group textarea:focus {
  outline: none;
  border-color: #4f6d7a;
}

.textarea-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.toolbar-btn {
  padding: 8px 16px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.2s;
}

.toolbar-btn:hover:not(:disabled) {
  background: #e0e0e0;
}

.toolbar-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hint {
  margin-top: 8px;
  font-size: 0.8rem;
  color: #888;
}

.save-btn {
  width: 100%;
  padding: 14px 24px;
  background: #4f6d7a;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}

.save-btn:hover:not(:disabled) {
  background: #3d5561;
}

.save-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message {
  margin-top: 15px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
}

.message.error {
  background: #fee;
  color: #c33;
  border: 1px solid #fcc;
}

.result-card {
  margin-top: 20px;
  padding: 16px;
  background: #efe;
  border: 1px solid #cfc;
  border-radius: 8px;
}

.result-card h3 {
  color: #363;
  font-size: 1rem;
  margin-bottom: 12px;
}

.result-details {
  font-size: 0.9rem;
}

.result-row {
  margin: 8px 0;
}

.result-row .label {
  color: #666;
  margin-right: 8px;
}

.result-row code {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.85rem;
}

.info-card {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
}

.info-card h3 {
  color: #333;
  font-size: 1rem;
  margin-bottom: 10px;
}

.info-card p {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 12px;
}

.info-card ul {
  color: #666;
  font-size: 0.9rem;
  padding-left: 20px;
}

.info-card li {
  margin: 6px 0;
}
</style>
