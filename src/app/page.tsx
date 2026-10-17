'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, isBefore, isAfter, startOfDay } from 'date-fns'

// Types
interface GameState {
  guesses: string[]
  currentGuess: string
  isWon: boolean
  isLost: boolean
  gameDate: string
  letterStates: { letter: string; status: string }[][]
}

interface DailyInfo {
  date: string
  letterCount: number
  hint: {
    country: string
    position: string
    popularity: string
  }
  answerHash: string
}

interface FootballerAnswer {
  id: number
  name: string
  normalizedName: string
  country: string
  position: string
  popularity: string
  info: string
  achievements: string[]
  active: boolean
  birthYear: number
  letterCount: number
}

interface GameStats {
  gamesPlayed: number
  gamesWon: number
  currentStreak: number
  maxStreak: number
  guessDistribution: number[]
}

// Keyboard layout
const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫']
]

// Game configuration
const START_DATE = new Date('2025-03-05')
const MAX_GUESSES = 10

export default function Home() {
  // Game state
  const [dailyInfo, setDailyInfo] = useState<DailyInfo | null>(null)
  const [gameState, setGameState] = useState<GameState>({
    guesses: [],
    currentGuess: '',
    isWon: false,
    isLost: false,
    gameDate: '',
    letterStates: []
  })
  const [answer, setAnswer] = useState<FootballerAnswer | null>(null)
  const [keyboardStates, setKeyboardStates] = useState<Map<string, string>>(new Map())
  const [stats, setStats] = useState<GameStats>({
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: Array(10).fill(0)
  })
  const [showStats, setShowStats] = useState(false)
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [loading, setLoading] = useState(true)
  const [shakeRow, setShakeRow] = useState(false)
  const [message, setMessage] = useState('')
  const [savedGames, setSavedGames] = useState<Record<string, GameState>>({})
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Update keyboard states from letter states
  const updateKeyboardFromStates = useCallback((letterStates: { letter: string; status: string }[][]) => {
    const newStates = new Map<string, string>()
    letterStates.flat().forEach(({ letter, status }) => {
      const currentStatus = newStates.get(letter)
      if (!currentStatus ||
          (currentStatus === 'absent' && status !== 'absent') ||
          (currentStatus === 'present' && status === 'correct')) {
        newStates.set(letter, status)
      }
    })
    setKeyboardStates(newStates)
  }, [])

  // Load game data
  useEffect(() => {
    const loadGame = async () => {
      setLoading(true)
      try {
        // Load saved games from localStorage
        const stored = localStorage.getItem('footballer-wordle')
        if (stored) {
          setSavedGames(JSON.parse(stored))
        }

        // Load stats
        const storedStats = localStorage.getItem('footballer-wordle-stats')
        if (storedStats) {
          setStats(JSON.parse(storedStats))
        }

        // Get today's game info
        const today = startOfDay(new Date())
        const dateStr = format(today, 'yyyy-MM-dd')
        
        // Check if today is before start date
        if (isBefore(today, START_DATE)) {
          setMessage(`Game starts on ${format(START_DATE, 'MMMM d, yyyy')}!`)
          setLoading(false)
          return
        }

        const response = await fetch(`/api/daily?date=${dateStr}`)
        const data = await response.json()
        
        if (data.error) {
          setMessage(data.error)
        } else {
          setDailyInfo(data)
          setCurrentDate(today)
          
          // Check for saved game state
          if (stored) {
            const games = JSON.parse(stored)
            const savedState = games[dateStr]
            if (savedState) {
              setGameState(savedState)
              updateKeyboardFromStates(savedState.letterStates || [])
              if (savedState.isWon || savedState.isLost) {
                // Load the answer
                const answerRes = await fetch(`/api/daily/answer?date=${dateStr}`)
                const answerData = await answerRes.json()
                if (answerData.footballer) {
                  setAnswer(answerData.footballer)
                }
              }
            } else {
              setGameState(prev => ({ ...prev, gameDate: dateStr, letterStates: [] }))
            }
          } else {
            setGameState(prev => ({ ...prev, gameDate: dateStr, letterStates: [] }))
          }
        }
      } catch (error) {
        console.error('Failed to load game:', error)
        setMessage('Failed to load game. Please try again.')
      }
      setLoading(false)
    }

    loadGame()
  }, [updateKeyboardFromStates])

  // Save game state
  const saveGameState = useCallback((state: GameState) => {
    const games = { ...savedGames, [state.gameDate]: state }
    setSavedGames(games)
    localStorage.setItem('footballer-wordle', JSON.stringify(games))
  }, [savedGames])

  // Handle guess submission
  const handleSubmit = async () => {
    if (!dailyInfo || gameState.isWon || gameState.isLost || isSubmitting) return
    if (gameState.currentGuess.length !== dailyInfo.letterCount) {
      setShakeRow(true)
      setMessage(`Name must be ${dailyInfo.letterCount} letters`)
      setTimeout(() => {
        setShakeRow(false)
        setMessage('')
      }, 1500)
      return
    }

    setIsSubmitting(true)

    try {
      // Submit guess
      const response = await fetch('/api/daily/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: gameState.gameDate,
          guess: gameState.currentGuess
        })
      })
      const data = await response.json()

      if (!data.isValidGuess) {
        setShakeRow(true)
        setMessage('Not in the footballer list')
        setTimeout(() => {
          setShakeRow(false)
          setMessage('')
        }, 1500)
        setIsSubmitting(false)
        return
      }

      const newGuesses = [...gameState.guesses, gameState.currentGuess]
      const newLetterStates = [...gameState.letterStates, data.letterStates]
      let isWon = false
      let isLost = false

      if (data.isCorrect) {
        isWon = true
        // Load answer
        const answerRes = await fetch(`/api/daily/answer?date=${gameState.gameDate}`)
        const answerData = await answerRes.json()
        if (answerData.footballer) {
          setAnswer(answerData.footballer)
        }
        setMessage('🎉 Congratulations!')
        
        // Update stats
        const newStats = {
          ...stats,
          gamesPlayed: stats.gamesPlayed + 1,
          gamesWon: stats.gamesWon + 1,
          currentStreak: stats.currentStreak + 1,
          maxStreak: Math.max(stats.maxStreak, stats.currentStreak + 1),
          guessDistribution: stats.guessDistribution.map((g, i) => 
            i === newGuesses.length - 1 ? g + 1 : g
          )
        }
        setStats(newStats)
        localStorage.setItem('footballer-wordle-stats', JSON.stringify(newStats))
      } else if (newGuesses.length >= MAX_GUESSES) {
        isLost = true
        // Load answer
        const answerRes = await fetch(`/api/daily/answer?date=${gameState.gameDate}`)
        const answerData = await answerRes.json()
        if (answerData.footballer) {
          setAnswer(answerData.footballer)
          setMessage(`The answer was ${answerData.footballer.name}`)
        }
        
        // Update stats
        const newStats = {
          ...stats,
          gamesPlayed: stats.gamesPlayed + 1,
          currentStreak: 0,
        }
        setStats(newStats)
        localStorage.setItem('footballer-wordle-stats', JSON.stringify(newStats))
      }

      const newState: GameState = {
        ...gameState,
        guesses: newGuesses,
        currentGuess: '',
        isWon,
        isLost,
        letterStates: newLetterStates
      }
      setGameState(newState)
      saveGameState(newState)
      updateKeyboardFromStates(newLetterStates)

    } catch (error) {
      console.error('Failed to submit guess:', error)
      setMessage('Failed to submit guess')
    }
    setIsSubmitting(false)
  }

  // Handle keyboard input
  const handleKeyClick = (key: string) => {
    if (gameState.isWon || gameState.isLost || !dailyInfo || isSubmitting) return

    if (key === 'ENTER') {
      handleSubmit()
    } else if (key === '⌫') {
      setGameState(prev => ({
        ...prev,
        currentGuess: prev.currentGuess.slice(0, -1)
      }))
    } else if (gameState.currentGuess.length < dailyInfo.letterCount) {
      setGameState(prev => ({
        ...prev,
        currentGuess: prev.currentGuess + key
      }))
    }
  }

  // Physical keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.isWon || gameState.isLost || !dailyInfo || isSubmitting) return

      if (e.key === 'Enter') {
        handleSubmit()
      } else if (e.key === 'Backspace') {
        setGameState(prev => ({
          ...prev,
          currentGuess: prev.currentGuess.slice(0, -1)
        }))
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        if (gameState.currentGuess.length < dailyInfo.letterCount) {
          setGameState(prev => ({
            ...prev,
            currentGuess: prev.currentGuess + e.key.toUpperCase()
          }))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameState, dailyInfo, handleSubmit, isSubmitting])

  // Load game for a specific date
  const loadGameForDate = async (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    
    if (isAfter(date, new Date())) {
      setMessage('Cannot play future games')
      return
    }
    if (isBefore(date, START_DATE)) {
      setMessage('Game not available before start date')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/daily?date=${dateStr}`)
      const data = await response.json()
      
      if (data.error) {
        setMessage(data.error)
      } else {
        setDailyInfo(data)
        setCurrentDate(date)
        setAnswer(null)
        setKeyboardStates(new Map())
        setMessage('')
        
        // Check for saved game
        const savedState = savedGames[dateStr]
        if (savedState) {
          setGameState(savedState)
          updateKeyboardFromStates(savedState.letterStates || [])
          if (savedState.isWon || savedState.isLost) {
            const answerRes = await fetch(`/api/daily/answer?date=${dateStr}`)
            const answerData = await answerRes.json()
            if (answerData.footballer) {
              setAnswer(answerData.footballer)
            }
          }
        } else {
          setGameState({
            guesses: [],
            currentGuess: '',
            isWon: false,
            isLost: false,
            gameDate: dateStr,
            letterStates: []
          })
        }
      }
    } catch (error) {
      console.error('Failed to load game:', error)
      setMessage('Failed to load game')
    }
    setLoading(false)
    setShowCalendar(false)
  }

  // Generate calendar days
  const generateCalendarDays = () => {
    const days: { date: Date; status: string }[] = []
    const today = startOfDay(new Date())
    let current = START_DATE
    
    while (!isAfter(current, today)) {
      const dateStr = format(current, 'yyyy-MM-dd')
      const savedGame = savedGames[dateStr]
      let status = 'available'
      if (savedGame?.isWon) status = 'won'
      else if (savedGame?.isLost) status = 'lost'
      
      days.push({ date: new Date(current), status })
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000)
    }
    
    return days
  }

  // Get letter status color
  const getLetterColor = (status: string) => {
    switch (status) {
      case 'correct': return 'bg-green-500 border-green-600 text-white'
      case 'present': return 'bg-yellow-500 border-yellow-600 text-white'
      case 'absent': return 'bg-gray-500 border-gray-600 text-white'
      default: return 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
    }
  }

  // Render game board
  const renderGameBoard = () => {
    if (!dailyInfo) return null
    
    const rows = []
    for (let i = 0; i < MAX_GUESSES; i++) {
      const cells = []
      const guess = gameState.guesses[i]
      const letterStateRow = gameState.letterStates[i] || []
      const isCurrentRow = i === gameState.guesses.length && !gameState.isWon && !gameState.isLost
      
      for (let j = 0; j < dailyInfo.letterCount; j++) {
        let letter = ''
        let status = 'empty'
        
        if (guess && letterStateRow[j]) {
          letter = letterStateRow[j].letter
          status = letterStateRow[j].status
        } else if (guess) {
          letter = guess[j] || ''
          status = 'pending'
        } else if (isCurrentRow) {
          letter = gameState.currentGuess[j] || ''
          status = letter ? 'pending' : 'empty'
        }
        
        cells.push(
          <div
            key={j}
            className={`
              w-10 h-12 sm:w-12 sm:h-14
              flex items-center justify-center
              text-xl sm:text-2xl font-bold
              border-2 rounded-md
              transition-all duration-300
              ${getLetterColor(status)}
              ${shakeRow && isCurrentRow ? 'animate-shake' : ''}
            `}
          >
            {letter}
          </div>
        )
      }
      rows.push(
        <div key={i} className="flex gap-1 sm:gap-2 justify-center">
          {cells}
        </div>
      )
    }
    return rows
  }

  // Render keyboard
  const renderKeyboard = () => {
    return KEYBOARD_ROWS.map((row, rowIndex) => (
      <div key={rowIndex} className="flex gap-1 sm:gap-2 justify-center mb-2">
        {row.map(key => {
          const keyStatus = keyboardStates.get(key) || ''
          const isSpecialKey = key === 'ENTER' || key === '⌫'
          
          return (
            <button
              key={key}
              onClick={() => handleKeyClick(key)}
              className={`
                ${isSpecialKey ? 'px-2 sm:px-4' : 'w-8 sm:w-10'}
                h-10 sm:h-12
                rounded-md font-bold text-sm sm:text-base
                transition-all duration-150
                active:scale-95
                ${getLetterColor(keyStatus)}
                ${!keyStatus ? 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600' : ''}
              `}
            >
              {key}
            </button>
          )
        })}
      </div>
    ))
  }

  // Render stats modal
  const renderStatsModal = () => {
    if (!showStats) return null
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowStats(false)}>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Statistics</h2>
            <button onClick={() => setShowStats(false)} className="text-2xl hover:opacity-70">&times;</button>
          </div>
          
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.gamesPlayed}</div>
              <div className="text-xs text-gray-500">Played</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.gamesPlayed > 0 ? Math.round(stats.gamesWon / stats.gamesPlayed * 100) : 0}</div>
              <div className="text-xs text-gray-500">Win %</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.currentStreak}</div>
              <div className="text-xs text-gray-500">Current Streak</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.maxStreak}</div>
              <div className="text-xs text-gray-500">Max Streak</div>
            </div>
          </div>
          
          <h3 className="font-bold mb-2">Guess Distribution</h3>
          <div className="space-y-1">
            {stats.guessDistribution.map((count, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-4 text-right">{i + 1}</div>
                <div 
                  className="bg-green-500 h-5 text-white text-xs flex items-center justify-end px-2 rounded min-w-[20px]"
                  style={{ width: `${Math.max(count * 20, 20)}px` }}
                >
                  {count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Render how to play modal
  const renderHowToPlayModal = () => {
    if (!showHowToPlay) return null
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowHowToPlay(false)}>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">How To Play</h2>
            <button onClick={() => setShowHowToPlay(false)} className="text-2xl hover:opacity-70">&times;</button>
          </div>
          
          <div className="space-y-4 text-sm">
            <p>Guess the footballer in 10 tries!</p>
            
            <ul className="list-disc pl-5 space-y-2">
              <li>Each guess must be a valid footballer name</li>
              <li>The number of letters varies each day (3-10)</li>
              <li>The color of the tiles will change after each guess</li>
            </ul>
            
            <div className="space-y-2 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center text-white font-bold">M</div>
                <span className="text-sm">Green: Letter is in the correct position</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center text-white font-bold">E</div>
                <span className="text-sm">Yellow: Letter is in the word but wrong position</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-500 rounded flex items-center justify-center text-white font-bold">S</div>
                <span className="text-sm">Gray: Letter is not in the word</span>
              </div>
            </div>
            
            <p className="font-bold mt-4">Hint:</p>
            <p>Country, Position, and Popularity level are shown to help you!</p>
          </div>
        </div>
      </div>
    )
  }

  // Render calendar modal
  const renderCalendarModal = () => {
    if (!showCalendar) return null
    
    const days = generateCalendarDays()
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCalendar(false)}>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Previous Games</h2>
            <button onClick={() => setShowCalendar(false)} className="text-2xl hover:opacity-70">&times;</button>
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={i} className="text-center text-xs font-bold text-gray-500">{day}</div>
            ))}
            
            {/* Empty cells for alignment */}
            {Array(new Date(START_DATE).getDay()).fill(null).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            
            {days.map(({ date, status }) => (
              <button
                key={date.toISOString()}
                onClick={() => loadGameForDate(date)}
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm
                  transition-all duration-150 hover:scale-110
                  ${format(date, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd')
                    ? 'ring-2 ring-blue-500'
                    : ''
                  }
                  ${status === 'won' ? 'bg-green-500 text-white' : ''}
                  ${status === 'lost' ? 'bg-red-500 text-white' : ''}
                  ${status === 'available' ? 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600' : ''}
                `}
              >
                {date.getDate()}
              </button>
            ))}
          </div>
          
          <div className="flex gap-4 mt-4 text-xs justify-center">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-500 rounded-full" />
              <span>Won</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-red-500 rounded-full" />
              <span>Lost</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <span>Available</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render answer info
  const renderAnswerInfo = () => {
    if (!answer || (!gameState.isWon && !gameState.isLost)) return null
    
    return (
      <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 rounded-xl max-w-md mx-auto">
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-2">{answer.name}</h3>
          <p className="text-gray-600 dark:text-gray-400">{answer.country} • {answer.position}</p>
          {answer.popularity === 'legendary' && (
            <span className="inline-block mt-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-sm">
              ⭐ Legendary Player
            </span>
          )}
        </div>
        
        <div className="mt-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">{answer.info}</p>
        </div>
        
        <div className="mt-4">
          <h4 className="font-bold text-sm mb-2">Achievements:</h4>
          <div className="flex flex-wrap gap-1">
            {answer.achievements.map((achievement, i) => (
              <span 
                key={i}
                className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs"
              >
                {achievement}
              </span>
            ))}
          </div>
        </div>
        
        <div className="mt-4 text-xs text-gray-500 text-center">
          Born: {answer.birthYear} • {answer.active ? 'Active' : 'Retired'}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-md z-40">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button 
            onClick={() => setShowHowToPlay(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="text-xl">❓</span>
          </button>
          
          <h1 className="text-xl sm:text-2xl font-bold text-center flex items-center gap-2">
            <span className="text-2xl">⚽</span>
            <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              Footballer Wordle
            </span>
          </h1>
          
          <div className="flex gap-1">
            <button 
              onClick={() => setShowStats(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="text-xl">📊</span>
            </button>
            <button 
              onClick={() => setShowCalendar(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="text-xl">📅</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent" />
            <p className="text-gray-500 dark:text-gray-400">Loading game...</p>
          </div>
        ) : (
          <>
            {/* Date and hint */}
            {dailyInfo && (
              <div className="text-center mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {format(currentDate, 'MMMM d, yyyy')}
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
                    🌍 {dailyInfo.hint.country}
                  </span>
                  <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm font-medium">
                    🏃 {dailyInfo.hint.position}
                  </span>
                  <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-full text-sm font-medium">
                    {dailyInfo.hint.popularity === 'legendary' ? '⭐' : dailyInfo.hint.popularity === 'world-class' ? '🌟' : '✨'} {dailyInfo.hint.popularity}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 font-medium">
                  {dailyInfo.letterCount} letters
                </p>
              </div>
            )}

            {/* Message */}
            {message && (
              <div className="text-center mb-4">
                <p className="text-sm font-medium px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg inline-block">
                  {message}
                </p>
              </div>
            )}

            {/* Game board */}
            {dailyInfo && (
              <div className="flex flex-col gap-1 sm:gap-2 mb-6">
                {renderGameBoard()}
              </div>
            )}

            {/* Answer info */}
            {renderAnswerInfo()}

            {/* Keyboard */}
            {dailyInfo && !gameState.isWon && !gameState.isLost && (
              <div className="mt-6">
                {renderKeyboard()}
              </div>
            )}

            {/* Play again / Share */}
            {(gameState.isWon || gameState.isLost) && (
              <div className="mt-6 flex flex-col gap-3 items-center">
                <button
                  onClick={() => setShowCalendar(true)}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl"
                >
                  🎮 Play Another Game
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {renderStatsModal()}
      {renderHowToPlayModal()}
      {renderCalendarModal()}

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-500 dark:text-gray-400">
        <p>Based on Wordle • Footballer data encrypted and secure</p>
        <p className="mt-1">Start date: {format(START_DATE, 'MMMM d, yyyy')}</p>
      </footer>
    </div>
  )
}
