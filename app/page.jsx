"use client"

import { useState, useEffect, useRef } from "react"
import { GoogleGenerativeAI } from "@google/generative-ai"

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI("AIzaSyCcpUJqhv-Ub3NGsSWILMxbEe7WzLCbhc4")
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })

// Enhanced Task interface
const createTask = (text, dueDate = null, parentId = null, category = "Personal", priority = "medium") => ({
  id: Date.now() + Math.random(),
  text: text.trim(),
  completed: false,
  createdAt: new Date(),
  dueDate: dueDate,
  parentId: parentId,
  subtasks: [],
  isEditing: false,
  priority: priority,
  category: category,
})

export default function TaskMaster() {
  // State management
  const [tasks, setTasks] = useState([])
  const [inputValue, setInputValue] = useState("")
  const [filter, setFilter] = useState("all")
  const [darkMode, setDarkMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedPriority, setSelectedPriority] = useState("all")

  // Voice Assistant States
  const [isVoiceListening, setIsVoiceListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState("")
  const [isVoiceSupported, setIsVoiceSupported] = useState(false)
  const [voiceCommand, setVoiceCommand] = useState("")
  const [showVoicePanel, setShowVoicePanel] = useState(false)
  const [voiceFeedback, setVoiceFeedback] = useState("")

  // AI Assistant States
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [isAILoading, setIsAILoading] = useState(false)
  const [aiChatHistory, setAiChatHistory] = useState([])
  const [aiInput, setAiInput] = useState("")
  const [taskSuggestions, setTaskSuggestions] = useState([])
  const [suggestedCategory, setSuggestedCategory] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Refs
  const recognitionRef = useRef(null)
  const synthRef = useRef(null)
  const editInputRef = useRef(null)
  const aiInputRef = useRef(null)

  // Categories and priorities
  const categories = ["Work", "Personal", "Health", "Urgent", "Learning", "Shopping", "Chores"]
  const priorities = ["low", "medium", "high"]

  // Voice Commands Configuration
  const voiceCommands = {
    add: /^add task (.+)$/i,
    delete: /^delete task (\d+)$/i,
    complete: /^(?:mark task (\d+) as (?:done|completed)|complete task (\d+))$/i,
    showCompleted: /^show completed tasks?$/i,
    showActive: /^show (?:active|pending) tasks?$/i,
    showAll: /^show all tasks?$/i,
    clearAll: /^clear all tasks?$/i,
    help: /^(?:help|what can you do|commands)$/i,
  }

  // AI Assistant Functions
  const getAITaskSuggestions = async (taskText) => {
    if (!taskText.trim() || taskText.length < 3) {
      setTaskSuggestions([])
      setSuggestedCategory("")
      setShowSuggestions(false)
      return
    }

    try {
      setIsAILoading(true)
      const prompt = `You're an intelligent productivity assistant. When given a task title, provide 3 similar task suggestions and categorize it.

Task: "${taskText}"

Categories: ["Work", "Personal", "Health", "Urgent", "Learning", "Shopping", "Chores"]

Respond ONLY with valid JSON in this exact format:
{
  "task": "${taskText}",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "category": "category_name"
}`

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      try {
        const aiResponse = JSON.parse(text.replace(/```json\n?|\n?```/g, ""))
        setTaskSuggestions(aiResponse.suggestions || [])
        setSuggestedCategory(aiResponse.category || "Personal")
        setShowSuggestions(true)
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError)
        setTaskSuggestions([])
        setSuggestedCategory("Personal")
        setShowSuggestions(false)
      }
    } catch (error) {
      console.error("Error getting AI suggestions:", error)
      setTaskSuggestions([])
      setSuggestedCategory("Personal")
      setShowSuggestions(false)
    } finally {
      setIsAILoading(false)
    }
  }

  const generateTasksFromGoal = async (goal) => {
    try {
      setIsAILoading(true)
      const prompt = `You're an AI task generator. When given a goal or topic, generate 5-7 specific, actionable tasks.

Goal: "${goal}"

Generate tasks that are:
- Specific and actionable
- Concise but clear
- Relevant to the goal
- Ordered by logical sequence

Respond ONLY with valid JSON in this exact format:
{
  "goal": "${goal}",
  "generatedTasks": ["Task 1", "Task 2", "Task 3", "Task 4", "Task 5"]
}`

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      try {
        const aiResponse = JSON.parse(text.replace(/```json\n?|\n?```/g, ""))

        // Add generated tasks to the task list
        if (aiResponse.generatedTasks && Array.isArray(aiResponse.generatedTasks)) {
          aiResponse.generatedTasks.forEach((taskText, index) => {
            setTimeout(() => {
              addTask(taskText, null, null, "Work", "medium")
            }, index * 200) // Stagger the additions for better UX
          })

          // Add to chat history
          setAiChatHistory((prev) => [
            ...prev,
            {
              type: "user",
              message: goal,
              timestamp: new Date(),
            },
            {
              type: "ai",
              message: `I've generated ${aiResponse.generatedTasks.length} tasks for your goal: "${goal}". The tasks have been added to your list!`,
              timestamp: new Date(),
              data: aiResponse,
            },
          ])

          speak(`I've generated ${aiResponse.generatedTasks.length} tasks for your goal and added them to your list.`)
        }
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError)
        setAiChatHistory((prev) => [
          ...prev,
          {
            type: "ai",
            message: "Sorry, I had trouble generating tasks for that goal. Please try rephrasing it.",
            timestamp: new Date(),
          },
        ])
      }
    } catch (error) {
      console.error("Error generating tasks:", error)
      setAiChatHistory((prev) => [
        ...prev,
        {
          type: "ai",
          message: "Sorry, I'm having trouble connecting to generate tasks right now. Please try again later.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsAILoading(false)
    }
  }

  const getProductivityCoaching = async (request) => {
    try {
      setIsAILoading(true)

      const currentTasksContext = tasks
        .map(
          (task, index) =>
            `${index + 1}. ${task.text} [${task.category}] [${task.priority}] ${task.completed ? "[COMPLETED]" : "[PENDING]"}`,
        )
        .join("\n")

      const prompt = `You're a personal productivity coach. The user has asked: "${request}"

Current tasks:
${currentTasksContext}

Provide helpful, motivating advice and if applicable, suggest task reorganization or prioritization.

Respond ONLY with valid JSON in this exact format:
{
  "coachingResponse": "Your helpful, motivating response as a productivity coach",
  "updatedTasks": []
}`

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      try {
        const aiResponse = JSON.parse(text.replace(/```json\n?|\n?```/g, ""))

        setAiChatHistory((prev) => [
          ...prev,
          {
            type: "user",
            message: request,
            timestamp: new Date(),
          },
          {
            type: "ai",
            message: aiResponse.coachingResponse,
            timestamp: new Date(),
            data: aiResponse,
          },
        ])

        speak("I've provided some productivity coaching advice in the AI panel.")
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError)
        setAiChatHistory((prev) => [
          ...prev,
          {
            type: "ai",
            message:
              "I'm here to help with your productivity! Try asking me to help plan your day, prioritize tasks, or generate tasks for a specific goal.",
            timestamp: new Date(),
          },
        ])
      }
    } catch (error) {
      console.error("Error getting coaching:", error)
      setAiChatHistory((prev) => [
        ...prev,
        {
          type: "ai",
          message: "I'm having trouble providing coaching right now. Please try again later.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsAILoading(false)
    }
  }

  const handleAIInput = async () => {
    if (!aiInput.trim()) return

    const input = aiInput.trim()
    setAiInput("")

    // Determine the type of request
    if (
      input.toLowerCase().includes("generate") ||
      input.toLowerCase().includes("create tasks") ||
      input.toLowerCase().includes("help me with")
    ) {
      await generateTasksFromGoal(input)
    } else if (
      input.toLowerCase().includes("plan") ||
      input.toLowerCase().includes("organize") ||
      input.toLowerCase().includes("prioritize")
    ) {
      await getProductivityCoaching(input)
    } else {
      // General coaching
      await getProductivityCoaching(input)
    }
  }

  // Debounced AI suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue.trim().length >= 3) {
        getAITaskSuggestions(inputValue)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [inputValue])

  // Local Storage functions
  const saveToLocalStorage = (tasksToSave) => {
    try {
      localStorage.setItem("taskmaster-tasks", JSON.stringify(tasksToSave))
    } catch (error) {
      console.error("Error saving to localStorage:", error)
    }
  }

  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem("taskmaster-tasks")
      if (saved) {
        const parsedTasks = JSON.parse(saved)
        return parsedTasks.map((task) => ({
          ...task,
          createdAt: new Date(task.createdAt),
          dueDate: task.dueDate ? new Date(task.dueDate) : null,
          subtasks:
            task.subtasks?.map((subtask) => ({
              ...subtask,
              createdAt: new Date(subtask.createdAt),
              dueDate: subtask.dueDate ? new Date(subtask.dueDate) : null,
            })) || [],
        }))
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error)
    }
    return []
  }

  // Speech Synthesis (Text-to-Speech)
  const speak = (text) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      utterance.pitch = 1
      utterance.volume = 0.8
      setVoiceFeedback(text)
      setTimeout(() => setVoiceFeedback(""), 3000)
      window.speechSynthesis.speak(utterance)
    }
  }

  // Process Voice Commands
  const processVoiceCommand = (transcript) => {
    const command = transcript.toLowerCase().trim()
    setVoiceCommand(command)

    const addMatch = command.match(voiceCommands.add)
    if (addMatch) {
      const taskText = addMatch[1]
      addTask(taskText)
      speak(`Task "${taskText}" added successfully`)
      return
    }

    const deleteMatch = command.match(voiceCommands.delete)
    if (deleteMatch) {
      const taskNumber = Number.parseInt(deleteMatch[1])
      const taskIndex = taskNumber - 1
      const filteredTasks = getFilteredTasks()

      if (taskIndex >= 0 && taskIndex < filteredTasks.length) {
        const taskToDelete = filteredTasks[taskIndex]
        deleteTask(taskToDelete.id)
        speak(`Task ${taskNumber} deleted successfully`)
      } else {
        speak(`Task ${taskNumber} not found. You have ${filteredTasks.length} tasks.`)
      }
      return
    }

    const completeMatch = command.match(voiceCommands.complete)
    if (completeMatch) {
      const taskNumber = Number.parseInt(completeMatch[1] || completeMatch[2])
      const taskIndex = taskNumber - 1
      const filteredTasks = getFilteredTasks()

      if (taskIndex >= 0 && taskIndex < filteredTasks.length) {
        const taskToComplete = filteredTasks[taskIndex]
        if (!taskToComplete.completed) {
          toggleTask(taskToComplete.id)
          speak(`Task ${taskNumber} marked as completed`)
        } else {
          speak(`Task ${taskNumber} is already completed`)
        }
      } else {
        speak(`Task ${taskNumber} not found. You have ${filteredTasks.length} tasks.`)
      }
      return
    }

    if (voiceCommands.showCompleted.test(command)) {
      setFilter("completed")
      const completedCount = tasks.filter((t) => t.completed).length
      speak(`Showing ${completedCount} completed tasks`)
      return
    }

    if (voiceCommands.showActive.test(command)) {
      setFilter("active")
      const activeCount = tasks.filter((t) => !t.completed).length
      speak(`Showing ${activeCount} active tasks`)
      return
    }

    if (voiceCommands.showAll.test(command)) {
      setFilter("all")
      speak(`Showing all ${tasks.length} tasks`)
      return
    }

    if (voiceCommands.clearAll.test(command)) {
      if (tasks.length > 0) {
        setTasks([])
        speak("All tasks cleared successfully")
      } else {
        speak("No tasks to clear")
      }
      return
    }

    if (voiceCommands.help.test(command)) {
      speak(
        "You can say: Add task followed by task name, Delete task followed by number, Mark task followed by number as done, Show completed tasks, Show active tasks, Show all tasks, or Clear all tasks",
      )
      return
    }

    speak("Sorry, I didn't understand that command. Say 'help' to hear available commands.")
  }

  // Initialize app
  useEffect(() => {
    const savedTasks = loadFromLocalStorage()
    setTasks(savedTasks)

    const savedDarkMode = localStorage.getItem("taskmaster-darkMode")
    const systemDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches

    if (savedDarkMode !== null) {
      setDarkMode(JSON.parse(savedDarkMode))
    } else {
      setDarkMode(systemDarkMode)
    }

    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      setIsVoiceSupported(true)

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = "en-US"

      recognitionRef.current.onstart = () => {
        setIsVoiceListening(true)
        setVoiceTranscript("")
        setVoiceCommand("")
      }

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = ""
        let finalTranscript = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        setVoiceTranscript(finalTranscript + interimTranscript)

        if (finalTranscript) {
          processVoiceCommand(finalTranscript)
        }
      }

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error)
        setIsVoiceListening(false)
        if (event.error === "not-allowed") {
          speak("Microphone access denied. Please allow microphone access to use voice commands.")
        } else if (event.error === "no-speech") {
          speak("No speech detected. Please try again.")
        }
      }

      recognitionRef.current.onend = () => {
        setIsVoiceListening(false)
      }
    } else {
      setIsVoiceSupported(false)
    }

    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis
    }

    // Initialize AI chat with welcome message
    setAiChatHistory([
      {
        type: "ai",
        message:
          "Hi! I'm your AI productivity assistant. I can help you generate tasks, categorize them, and provide productivity coaching. Try asking me to 'generate tasks for learning React' or 'help me plan my evening'!",
        timestamp: new Date(),
      },
    ])
  }, [])

  useEffect(() => {
    if (tasks.length > 0 || localStorage.getItem("taskmaster-tasks")) {
      saveToLocalStorage(tasks)
    }
  }, [tasks])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
    localStorage.setItem("taskmaster-darkMode", JSON.stringify(darkMode))
  }, [darkMode])

  // Voice Assistant Functions
  const startVoiceListening = () => {
    if (recognitionRef.current && !isVoiceListening) {
      try {
        recognitionRef.current.start()
        setShowVoicePanel(true)
      } catch (error) {
        console.error("Error starting voice recognition:", error)
        speak("Error starting voice recognition. Please try again.")
      }
    }
  }

  const stopVoiceListening = () => {
    if (recognitionRef.current && isVoiceListening) {
      recognitionRef.current.stop()
      setShowVoicePanel(false)
    }
  }

  const toggleVoiceListening = () => {
    if (isVoiceListening) {
      stopVoiceListening()
    } else {
      startVoiceListening()
    }
  }

  // Add new task
  const addTask = (
    text = inputValue,
    dueDate = null,
    parentId = null,
    category = suggestedCategory || "Personal",
    priority = "medium",
  ) => {
    if (text.trim() !== "") {
      const newTask = createTask(text, dueDate, parentId, category, priority)

      if (parentId) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === parentId ? { ...task, subtasks: [...(task.subtasks || []), newTask] } : task,
          ),
        )
      } else {
        setTasks((prev) => [...prev, newTask])
      }

      if (!parentId) {
        setInputValue("")
        setTaskSuggestions([])
        setSuggestedCategory("")
        setShowSuggestions(false)
      }
    }
  }

  // Toggle task completion
  const toggleTask = (id, isSubtask = false, parentId = null) => {
    if (isSubtask && parentId) {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === parentId
            ? {
                ...task,
                subtasks: task.subtasks.map((subtask) =>
                  subtask.id === id ? { ...subtask, completed: !subtask.completed } : subtask,
                ),
              }
            : task,
        ),
      )
    } else {
      setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)))
    }
  }

  // Delete task
  const deleteTask = (id, isSubtask = false, parentId = null) => {
    if (isSubtask && parentId) {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === parentId ? { ...task, subtasks: task.subtasks.filter((subtask) => subtask.id !== id) } : task,
        ),
      )
    } else {
      setTasks((prev) => prev.filter((task) => task.id !== id))
    }
  }

  // Start editing task
  const startEditing = (id, isSubtask = false, parentId = null) => {
    if (isSubtask && parentId) {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === parentId
            ? {
                ...task,
                subtasks: task.subtasks.map((subtask) =>
                  subtask.id === id ? { ...subtask, isEditing: true } : { ...subtask, isEditing: false },
                ),
              }
            : { ...task, isEditing: false },
        ),
      )
    } else {
      setTasks((prev) =>
        prev.map((task) => (task.id === id ? { ...task, isEditing: true } : { ...task, isEditing: false })),
      )
    }

    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus()
        editInputRef.current.select()
      }
    }, 0)
  }

  // Save edited task
  const saveEdit = (id, newText, isSubtask = false, parentId = null) => {
    if (newText.trim() === "") return

    if (isSubtask && parentId) {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === parentId
            ? {
                ...task,
                subtasks: task.subtasks.map((subtask) =>
                  subtask.id === id ? { ...subtask, text: newText.trim(), isEditing: false } : subtask,
                ),
              }
            : task,
        ),
      )
    } else {
      setTasks((prev) =>
        prev.map((task) => (task.id === id ? { ...task, text: newText.trim(), isEditing: false } : task)),
      )
    }
  }

  // Cancel editing
  const cancelEdit = (id, isSubtask = false, parentId = null) => {
    if (isSubtask && parentId) {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === parentId
            ? {
                ...task,
                subtasks: task.subtasks.map((subtask) =>
                  subtask.id === id ? { ...subtask, isEditing: false } : subtask,
                ),
              }
            : task,
        ),
      )
    } else {
      setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, isEditing: false } : task)))
    }
  }

  // Filter tasks based on all criteria
  const getFilteredTasks = () => {
    const filtered = tasks.filter((task) => {
      const matchesSearch =
        task.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.subtasks?.some((subtask) => subtask.text.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesStatus =
        filter === "all" || (filter === "active" && !task.completed) || (filter === "completed" && task.completed)

      const matchesCategory = selectedCategory === "all" || task.category === selectedCategory
      const matchesPriority = selectedPriority === "all" || task.priority === selectedPriority

      return matchesSearch && matchesStatus && matchesCategory && matchesPriority
    })

    return filtered.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1
      }

      const priorityOrder = { high: 3, medium: 2, low: 1 }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      }

      return new Date(b.createdAt) - new Date(a.createdAt)
    })
  }

  // Get task counts
  const getTaskCounts = () => {
    const allTasks = tasks
    return {
      all: allTasks.length,
      active: allTasks.filter((t) => !t.completed).length,
      completed: allTasks.filter((t) => t.completed).length,
    }
  }

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "text-red-500 dark:text-red-400"
      case "medium":
        return "text-yellow-500 dark:text-yellow-400"
      case "low":
        return "text-green-500 dark:text-green-400"
      default:
        return "text-gray-500 dark:text-gray-400"
    }
  }

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      addTask()
    }
  }

  const filteredTasks = getFilteredTasks()
  const taskCounts = getTaskCounts()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1"></div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-white">TaskMaster AI</h1>
            <div className="flex-1 flex justify-end gap-2">
              <button
                onClick={() => setShowAIPanel(!showAIPanel)}
                className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 transition-all duration-200"
                title="AI Assistant"
              >
                🤖
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
                aria-label="Toggle dark mode"
              >
                {darkMode ? "☀️" : "🌙"}
              </button>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">AI-powered task management with smart suggestions</p>
        </header>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1">
            {/* Voice Assistant Panel */}
            {isVoiceSupported && (
              <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl shadow-lg p-6 mb-8 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full ${isVoiceListening ? "bg-red-400 animate-pulse" : "bg-green-400"}`}
                    ></div>
                    <h2 className="text-xl font-semibold">Voice Assistant</h2>
                  </div>
                  <button
                    onClick={toggleVoiceListening}
                    className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                      isVoiceListening
                        ? "bg-red-500 hover:bg-red-600 animate-pulse"
                        : "bg-white text-purple-600 hover:bg-gray-100"
                    }`}
                  >
                    {isVoiceListening ? "🛑 Stop Listening" : "🎤 Start Voice Commands"}
                  </button>
                </div>

                {showVoicePanel && (
                  <div className="bg-white/20 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold">Live Transcript:</h3>
                      <button onClick={() => setShowVoicePanel(false)} className="text-white/70 hover:text-white">
                        ✕
                      </button>
                    </div>
                    <div className="bg-black/20 rounded p-3 min-h-[60px]">
                      <p className="text-white/90">
                        {voiceTranscript ||
                          (isVoiceListening ? "Listening..." : "Click 'Start Voice Commands' to begin")}
                      </p>
                      {voiceCommand && <p className="text-yellow-200 mt-2 text-sm">Last command: "{voiceCommand}"</p>}
                    </div>
                  </div>
                )}

                {voiceFeedback && (
                  <div className="mt-4 bg-green-500/20 border border-green-400/30 rounded-lg p-3">
                    <p className="text-green-100">🔊 {voiceFeedback}</p>
                  </div>
                )}
              </div>
            )}

            {/* Add Task Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8 transition-colors duration-300 relative">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Add a new task (AI will suggest similar tasks)..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             placeholder-gray-500 dark:placeholder-gray-400
                             transition-all duration-200"
                  />
                  {isAILoading && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {isVoiceSupported && (
                    <button
                      onClick={toggleVoiceListening}
                      className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                        isVoiceListening
                          ? "bg-red-500 text-white animate-pulse"
                          : "bg-purple-500 hover:bg-purple-600 text-white"
                      }`}
                      title={isVoiceListening ? "Stop voice input" : "Start voice input"}
                    >
                      {isVoiceListening ? "🛑" : "🎤"}
                    </button>
                  )}
                  <button
                    onClick={() => addTask()}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium 
                             rounded-lg transition-colors duration-200 
                             focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                             dark:focus:ring-offset-gray-800"
                  >
                    Add Task
                  </button>
                </div>
              </div>

              {/* AI Suggestions */}
              {showSuggestions && taskSuggestions.length > 0 && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-blue-600 dark:text-blue-400">🤖</span>
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200">AI Suggestions</h3>
                    <span className="text-xs px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full">
                      {suggestedCategory}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {taskSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setInputValue(suggestion)
                          setShowSuggestions(false)
                        }}
                        className="w-full text-left px-3 py-2 bg-white dark:bg-gray-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors duration-200 text-sm"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Search and Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 transition-colors duration-300">
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tasks..."
                    className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             placeholder-gray-500 dark:placeholder-gray-400"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {["all", "active", "completed"].map((filterType) => (
                  <button
                    key={filterType}
                    onClick={() => setFilter(filterType)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 
                               ${
                                 filter === filterType
                                   ? "bg-blue-500 text-white shadow-md"
                                   : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                               }`}
                  >
                    {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                    <span className="ml-1 text-xs opacity-75">({taskCounts[filterType] || 0})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tasks List */}
            <div className="space-y-3">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <p className="text-gray-500 dark:text-gray-400 text-lg">
                    {searchQuery
                      ? "No tasks match your search."
                      : filter === "all"
                        ? "No tasks yet. Add one above or ask the AI assistant!"
                        : `No ${filter} tasks found.`}
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                    Try asking the AI: "Generate tasks for learning React" or "Help me plan my day"
                  </p>
                </div>
              ) : (
                filteredTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 
                             transform transition-all duration-300 hover:shadow-lg"
                    style={{
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-400">
                        {index + 1}
                      </div>

                      <button
                        onClick={() => toggleTask(task.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center
                                   transition-all duration-200 flex-shrink-0 mt-1
                                   ${
                                     task.completed
                                       ? "bg-green-500 border-green-500 text-white"
                                       : "border-gray-300 dark:border-gray-600 hover:border-green-400"
                                   }`}
                      >
                        {task.completed && (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        {task.isEditing ? (
                          <div className="flex gap-2">
                            <input
                              ref={editInputRef}
                              type="text"
                              defaultValue={task.text}
                              className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded
                                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              onKeyPress={(e) => {
                                if (e.key === "Enter") {
                                  saveEdit(task.id, e.target.value)
                                } else if (e.key === "Escape") {
                                  cancelEdit(task.id)
                                }
                              }}
                              onBlur={(e) => saveEdit(task.id, e.target.value)}
                            />
                            <button
                              onClick={() => cancelEdit(task.id)}
                              className="px-2 py-1 text-gray-500 hover:text-red-500"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-gray-800 dark:text-gray-200 transition-all duration-200
                                         ${task.completed ? "line-through text-gray-500 dark:text-gray-500" : ""}`}
                              >
                                {task.text}
                              </span>
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)} bg-gray-100 dark:bg-gray-700`}
                              >
                                {task.priority}
                              </span>
                              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                {task.category}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditing(task.id)}
                          className="p-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 
                                   dark:hover:text-blue-400 transition-colors duration-200
                                   hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                          title="Edit task"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 
                                   dark:hover:text-red-400 transition-colors duration-200
                                   hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          title="Delete task"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AI Assistant Panel */}
          {showAIPanel && (
            <div className="lg:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 h-fit">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  🤖 AI Assistant
                </h2>
                <button
                  onClick={() => setShowAIPanel(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              {/* AI Chat History */}
              <div className="h-96 overflow-y-auto mb-4 space-y-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                {aiChatHistory.map((message, index) => (
                  <div key={index} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.type === "user"
                          ? "bg-blue-500 text-white"
                          : "bg-white dark:bg-gray-600 text-gray-800 dark:text-white"
                      }`}
                    >
                      <p className="text-sm">{message.message}</p>
                      <p className="text-xs opacity-70 mt-1">{message.timestamp.toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
                {isAILoading && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-gray-600 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Input */}
              <div className="flex gap-2">
                <input
                  ref={aiInputRef}
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !isAILoading) {
                      handleAIInput()
                    }
                  }}
                  placeholder="Ask AI to generate tasks, plan your day..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           placeholder-gray-500 dark:placeholder-gray-400 text-sm"
                  disabled={isAILoading}
                />
                <button
                  onClick={handleAIInput}
                  disabled={isAILoading || !aiInput.trim()}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white 
                           rounded-lg transition-colors duration-200 text-sm"
                >
                  Send
                </button>
              </div>

              {/* Quick AI Actions */}
              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Quick Actions:</p>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => {
                      setAiInput("Generate tasks for learning React")
                      handleAIInput()
                    }}
                    className="text-left px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 text-sm"
                  >
                    📚 Generate learning tasks
                  </button>
                  <button
                    onClick={() => {
                      setAiInput("Help me plan my evening")
                      handleAIInput()
                    }}
                    className="text-left px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 text-sm"
                  >
                    🌅 Plan my evening
                  </button>
                  <button
                    onClick={() => {
                      setAiInput("Prioritize my urgent tasks")
                      handleAIInput()
                    }}
                    className="text-left px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 text-sm"
                  >
                    ⚡ Prioritize urgent tasks
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Task Summary */}
        {tasks.length > 0 && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 transition-colors duration-300">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Task Summary</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500">{taskCounts.all}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-500">{taskCounts.active}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Active</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">{taskCounts.completed}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
                </div>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${taskCounts.all > 0 ? (taskCounts.completed / taskCounts.all) * 100 : 0}%`,
                  }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {taskCounts.all > 0 ? Math.round((taskCounts.completed / taskCounts.all) * 100) : 0}% Complete
              </p>
            </div>
          </div>
        )}

        {/* Voice listening indicator */}
        {isVoiceListening && (
          <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse z-50">
            🎤 Listening for commands...
          </div>
        )}
      </div>
    </div>
  )
}
