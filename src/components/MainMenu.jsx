export function MainMenu({ webcam, onStartNormal, onStartCamera }) {
  return (
    <div className="menu-screen" data-ui="true">
      <div className="menu-card arcade-panel">
        <p className="eyebrow">Basketball Arcade</p>
        <h1>Arremesse, mire e pontue</h1>
        <p className="menu-description">
          Jogo no estilo máquina arcade de basquete: as bolas ficam dentro da baia, descem pela rampa, batem na barra frontal, ficam disponíveis e só saem da baia quando você arremessa.
        </p>

        <div className="menu-buttons compact">
          <button type="button" data-hand-click="true" onClick={onStartCamera} disabled={webcam.loading}>
            {webcam.loading ? 'Abrindo câmera...' : 'Jogar com Câmera'}
          </button>
          <button type="button" data-hand-click="true" onClick={onStartNormal}>Jogar normal</button>
        </div>

        {webcam.error && <div className="menu-error">{webcam.error}</div>}

        <div className="tutorials-box">
          <h2>Tutoriais do jogo</h2>
          <div className="tutorial-grid">
            <div>
              <strong>PC</strong>
              <p>A/D ou setas miram. Segure Espaço para carregar. Solte Espaço para arremessar. R reseta.</p>
            </div>
            <div>
              <strong>Mobile</strong>
              <p>Arraste o dedo para mirar. Segure para carregar. Solte para arremessar.</p>
            </div>
            <div>
              <strong>Webcam</strong>
              <p>No menu, a câmera lê a mão sem carregar o jogo 3D. Na partida: mão aberta mira, mão fechada carrega, abrir a mão arremessa.</p>
            </div>
          </div>
        </div>

        <div className="webcam-status-pill">
          Status webcam: {webcam.loading ? 'solicitando câmera...' : webcam.enabled ? webcam.handStatusLabel : 'câmera desativada ou bloqueada'}
        </div>
      </div>
    </div>
  )
}
