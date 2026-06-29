export function FinishedScreen({ score, onRestart, onMenu }) {
  return (
    <div className="menu-screen" data-ui="true">
      <div className="menu-card arcade-panel finish-card">
        <p className="eyebrow">Fim de partida</p>
        <h1>Pontuação final</h1>
        <div className="final-score">{score}</div>
        <div className="menu-buttons compact">
          <button type="button" data-hand-click="true" onClick={onRestart}>Jogar novamente</button>
          <button type="button" data-hand-click="true" onClick={onMenu}>Voltar ao menu</button>
        </div>
      </div>
    </div>
  )
}
