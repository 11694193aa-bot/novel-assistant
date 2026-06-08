import React, { useState, useRef } from 'react';
import useStore from '../store';
import questions from '../data/questions';

export default function GachaMachine({ books, onClose }) {
  const { addInspirationCard } = useStore();
  const [rolling, setRolling] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [savedCards, setSavedCards] = useState([]);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const rollRef = useRef(null);

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    setAnswer('');
    setShowSaveConfirm(false);

    // 滚动动画
    let count = 0;
    const maxCount = 20;
    const interval = setInterval(() => {
      const randomQ = questions[Math.floor(Math.random() * questions.length)];
      setCurrentQuestion(randomQ);
      count++;
      if (count >= maxCount) {
        clearInterval(interval);
        setRolling(false);
        // 最终选一个
        const finalQ = questions[Math.floor(Math.random() * questions.length)];
        setCurrentQuestion(finalQ);
      }
    }, 80);
  };

  const handleSaveToInspiration = () => {
    const card = addInspirationCard({
      title: currentQuestion.category + ' - 灵感',
      content: answer || '(空灵感记录)',
      category: currentQuestion.category,
      source: 'gacha',
      gachaQuestion: currentQuestion.text,
      bookId: null,
    });
    setSavedCards(prev => [...prev, card.id]);
    setShowSaveConfirm(true);
    setTimeout(() => setShowSaveConfirm(false), 2000);
  };

  const handleSaveAndClassify = (bookId) => {
    addInspirationCard({
      title: currentQuestion.category + ' - 灵感',
      content: answer || '(空灵感记录)',
      category: currentQuestion.category,
      source: 'gacha',
      gachaQuestion: currentQuestion.text,
      bookId,
    });
    setShowSaveConfirm(true);
    setTimeout(() => setShowSaveConfirm(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gacha-modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="gacha-header">
          <span className="gacha-title">🎰 灵感扭蛋机</span>
          <span className="gacha-subtitle">~ 转动扭蛋，获取灵感喵 ~</span>
        </div>

        <div className="gacha-machine-body">
          <div className={`gacha-display ${rolling ? 'rolling' : ''}`}>
            {currentQuestion ? (
              <div className="gacha-question">
                <span className="gacha-cat-big">🐱</span>
                <span className="gacha-q-cat">{currentQuestion.category}</span>
                <p className="gacha-q-text">{currentQuestion.text}</p>
              </div>
            ) : (
              <div className="gacha-placeholder">
                <span className="gacha-cat-anim">🐱</span>
                <p>点击下方按钮扭蛋~</p>
              </div>
            )}
          </div>

          {currentQuestion && !rolling && (
            <div className="gacha-answer-area">
              <textarea
                className="gacha-answer-input"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="在这里写下你的想法喵..."
                rows={5}
              />
              <div className="gacha-actions">
                <button className="btn btn-save" onClick={handleSaveToInspiration}>
                  💾 保存到灵感卡片
                </button>
                <div className="gacha-classify">
                  <span>📚 或分类到:</span>
                  {books.map(b => (
                    <button key={b.id} className="btn btn-classify" onClick={() => handleSaveAndClassify(b.id)}>
                      {b.title}
                    </button>
                  ))}
                </div>
              </div>
              {showSaveConfirm && (
                <div className="save-confirm">✅ 已保存到灵感卡片~</div>
              )}
            </div>
          )}
        </div>

        <button className="btn btn-roll" onClick={roll} disabled={rolling}>
          {rolling ? '🎰 扭蛋中...' : '🎰 扭一下!'}
        </button>
      </div>
    </div>
  );
}
