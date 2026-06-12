import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import './index.css';

pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const samplePapers = [
  {
    id: 1,
    title: 'Deep Learning for Communication',
    file: '/sample.pdf'
  },
  {
    id: 2,
    title: 'Cognitive Agents in Research',
    file: '/sample.pdf'
  }
];

function App() {
  const [papers, setPapers] = useState(samplePapers);
  const [selectedPaper, setSelectedPaper] = useState(samplePapers[0]);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [notes, setNotes] = useState([]);
  const [pageWidth, setPageWidth] = useState(800);
  const [zoom, setZoom] = useState(1.0);
  const [selectedText, setSelectedText] = useState('');
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupCoords, setPopupCoords] = useState({ top: 0, left: 0 });
  const [citationPopupVisible, setCitationPopupVisible] = useState(false);
  const [citationPaper, setCitationPaper] = useState(null);
  const [copiedFormat, setCopiedFormat] = useState(null);
  const [referencePopupVisible, setReferencePopupVisible] = useState(false);
  const [referenceStyle, setReferenceStyle] = useState(null);
  const [generatedReferences, setGeneratedReferences] = useState('');
  const [referenceCopied, setReferenceCopied] = useState(false);
  const fileInputRef = useRef(null);
  const viewerRef = useRef(null);
  const citationPopupRef = useRef(null);
  const referencePopupRef = useRef(null);

  useEffect(() => {
    if (!viewerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPageWidth(Math.max(200, Math.floor(entry.contentRect.width)));
      }
    });

    observer.observe(viewerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setPopupVisible(false);
        return;
      }

      const text = selection.toString().trim();
      if (!text) {
        setPopupVisible(false);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = viewerRef.current?.getBoundingClientRect();
      if (!containerRect) {
        setPopupVisible(false);
        return;
      }

      setSelectedText(text);
      setPopupCoords({
        top: rect.top - containerRect.top - 40,
        left: rect.left - containerRect.left + rect.width / 2
      });
      setPopupVisible(true);
    };

    const viewer = viewerRef.current;
    viewer?.addEventListener('mouseup', onMouseUp);
    return () => viewer?.removeEventListener('mouseup', onMouseUp);
  }, [pageNumber]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Please select a valid PDF file');
      return;
    }

    const fileUrl = URL.createObjectURL(file);
    const newPaper = {
      id: Date.now(),
      title: file.name.replace('.pdf', ''),
      file: fileUrl
    };

    setPapers((prev) => [newPaper, ...prev]);
    setSelectedPaper(newPaper);
    setPageNumber(1);
    setNumPages(null);
    setSelectedText('');
    setPopupVisible(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectPaper = (paper) => {
    setSelectedPaper(paper);
    setPageNumber(1);
    setNumPages(null);
    setSelectedText('');
    setPopupVisible(false);
    window.getSelection()?.removeAllRanges();
  };

  const onDocumentLoadSuccess = ({ numPages: nextNumPages }) => {
    setNumPages(nextNumPages);
    if (pageNumber > nextNumPages) {
      setPageNumber(nextNumPages);
    }
  };

  const handleSaveSelection = () => {
    if (!selectedText) return;

    // capture absolute Y position of selection for later scrolling
    let selY = null;
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        const rRect = r.getBoundingClientRect();
        selY = rRect.top;
      }
    } catch (e) {
      selY = null;
    }

    setNotes((prev) => [
      { id: Date.now(), text: selectedText, page: pageNumber, paperName: selectedPaper.title, y: selY },
      ...prev
    ]);

    setSelectedText('');
    setPopupVisible(false);
    window.getSelection()?.removeAllRanges();
  };

  const handleCancelSelection = () => {
    setSelectedText('');
    setPopupVisible(false);
    window.getSelection()?.removeAllRanges();
  };

  const handleDeleteNote = (noteId) => {
    setNotes((prev) => prev.filter((note) => note.id !== noteId));
  };

  const handlePreviousPage = () => {
    setPageNumber((prev) => Math.max(1, prev - 1));
    setPopupVisible(false);
  };

  const handleNextPage = () => {
    if (!numPages) return;
    setPageNumber((prev) => Math.min(numPages, prev + 1));
    setPopupVisible(false);
  };

  const handleZoomIn = () => {
    setZoom((prev) => prev + 0.2);
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(0.2, prev - 0.2));
  };

  const generateCitations = (paper) => {
    const title = paper.title;
    const apa = `Author, A., & Author, B. (Year). ${title}. Publisher.`;
    const mla = `Author, A., and B. Author. "${title}." Publisher, Year.`;
    const vancouver = `Author A, Author B. ${title}. Publisher; Year.`;
    return { apa, mla, vancouver };
  };

  const handleCiteClick = (e, paper) => {
    e.stopPropagation();
    setCitationPaper(paper);
    setCitationPopupVisible(true);
  };

  const handleCloseCitationPopup = () => {
    setCitationPopupVisible(false);
  };

  const handleCopyCitation = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(text);
    setTimeout(() => {
      setCopiedFormat(null);
    }, 2000);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (citationPopupRef.current && !citationPopupRef.current.contains(event.target)) {
        handleCloseCitationPopup();
      }
    };

    if (citationPopupVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [citationPopupVisible]);

  const generateReferenceList = (style) => {
    // Get unique papers from notes
    const uniquePapers = Array.from(
      new Map(notes.map((note) => [note.paperName, note.paperName])).values()
    );

    let referenceText = '';
    if (style === 'apa') {
      referenceText = uniquePapers
        .map((paper, idx) => `[${idx + 1}] Author, A., & Author, B. (Year). ${paper}. Publisher.`)
        .join('\n');
    } else if (style === 'mla') {
      referenceText = uniquePapers
        .map((paper, idx) => `[${idx + 1}] Author, A., and B. Author. "${paper}." Publisher, Year.`)
        .join('\n');
    } else if (style === 'vancouver') {
      referenceText = uniquePapers
        .map((paper, idx) => `[${idx + 1}] Author A, Author B. ${paper}. Publisher; Year.`)
        .join('\n');
    }

    setGeneratedReferences(referenceText);
  };

  const handleGenerateReferences = () => {
    setReferencePopupVisible(true);
    setReferenceStyle(null);
  };

  const handleSelectReferenceStyle = (style) => {
    setReferenceStyle(style);
    generateReferenceList(style);
  };

  const handleCloseReferencePopup = () => {
    setReferencePopupVisible(false);
    setReferenceStyle(null);
    setGeneratedReferences('');
  };

  const handleCopyReferences = () => {
    navigator.clipboard.writeText(generatedReferences);
    setReferenceCopied(true);
    setTimeout(() => {
      setReferenceCopied(false);
    }, 2000);
  };

  const getPaperReferenceNumber = (paperName) => {
    const seenPapers = [];
    for (const note of notes) {
      if (!seenPapers.includes(note.paperName)) {
        seenPapers.push(note.paperName);
      }
    }
    return seenPapers.indexOf(paperName) + 1;
  };

  useEffect(() => {
    const handleClickOutsideRef = (event) => {
      if (referencePopupRef.current && !referencePopupRef.current.contains(event.target)) {
        handleCloseReferencePopup();
      }
    };

    if (referencePopupVisible) {
      document.addEventListener('mousedown', handleClickOutsideRef);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutsideRef);
    };
  }, [referencePopupVisible]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Research Tool</h1>
          <p>Uploaded papers</p>
        </div>

        <button className="upload-button" onClick={handleUploadClick}>
          + Upload PDF
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />

        <div className="paper-list">
          {papers.map((paper) => (
            <div
              key={paper.id}
              style={{
                display: 'flex',
                gap: '6px',
                alignItems: 'center',
                marginBottom: '6px'
              }}
            >
              <button
                className={`paper-item ${selectedPaper.id === paper.id ? 'active' : ''}`}
                onClick={() => handleSelectPaper(paper)}
                style={{ flex: 1 }}
              >
                {paper.title}
              </button>
              <button
                onClick={(e) => handleCiteClick(e, paper)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'background 0.2s ease'
                }}
                onMouseOver={(e) => (e.target.style.background = 'rgba(255, 255, 255, 0.1)')}
                onMouseOut={(e) => (e.target.style.background = 'none')}
              >
                Cite
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main className="viewer-area">
        <div className="viewer-header">
          <div>
            <h2>{selectedPaper.title}</h2>
            <p>Page {pageNumber}{numPages ? ` of ${numPages}` : ''}</p>
          </div>
        </div>

        <div className="pdf-container" ref={viewerRef}>
          <Document file={selectedPaper.file} onLoadSuccess={onDocumentLoadSuccess}>
            <div style={{ transform: `scale(${1 / window.devicePixelRatio})`, transformOrigin: 'top left' }}>
              <Page
                pageNumber={pageNumber}
                width={pageWidth * zoom * window.devicePixelRatio}
                renderTextLayer={true}
                renderAnnotationLayer={false}
                devicePixelRatio={window.devicePixelRatio}
              />
            </div>
          </Document>

          {popupVisible && (
            <div
              className="selection-popup"
              style={{
                position: 'absolute',
                top: popupCoords.top,
                left: popupCoords.left,
                transform: 'translate(-50%, -100%)',
                zIndex: 20,
                display: 'flex',
                gap: '8px',
                background: 'rgba(255,255,255,0.96)',
                border: '1px solid rgba(156,163,175,0.35)',
                borderRadius: '12px',
                padding: '8px',
                boxShadow: '0 16px 40px rgba(15,23,42,0.18)'
              }}
            >
              <button
                className="page-button"
                onClick={handleSaveSelection}
                style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
              >
                Save
              </button>
              <button
                className="page-button"
                onClick={handleCancelSelection}
                style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="page-controls">
          <button className="page-button" onClick={handlePreviousPage} disabled={pageNumber === 1}>
            ← Previous
          </button>
          <button className="page-button" onClick={handleNextPage} disabled={!numPages || pageNumber === numPages}>
            Next →
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="page-button" onClick={handleZoomOut}>−</button>
            <span style={{ minWidth: '50px', textAlign: 'center', fontSize: '0.85rem' }}>{Math.round(zoom * 100)}%</span>
            <button className="page-button" onClick={handleZoomIn}>+</button>
          </div>
        </div>
      </main>

      <aside className="notes-panel">
        <div className="notes-header">
          <h2>Smart Notes</h2>
          <p>Saved text selections appear here.</p>
        </div>

        <div className="notes-list">
          {notes.length === 0 ? (
            <div className="notes-empty">No saved selections yet. Select text and save it.</div>
          ) : (
            notes.map((note, index) => (
              <div
                key={note.id}
                className="note-card"
                style={{ position: 'relative' }}
                onClick={() => {
                  setPageNumber(note.page);
                  if (note.y && viewerRef.current) {
                    // wait a bit for the page to render then scroll container
                    setTimeout(() => {
                      const containerRect = viewerRef.current.getBoundingClientRect();
                      const offset = Math.max(0, note.y - containerRect.top - 20);
                      viewerRef.current.scrollTop += offset;
                    }, 200);
                  }
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#2563eb', minWidth: '24px' }}>
                    [{getPaperReferenceNumber(note.paperName)}]
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNote(note.id);
                    }}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: 'none',
                      border: 'none',
                      color: '#999',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      padding: '2px',
                      lineHeight: '1',
                      zIndex: 10
                    }}
                    aria-label="Delete note"
                  >
                    ×
                  </button>
                </div>
                <div className="note-page">Page {note.page}</div>
                <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '8px' }}>{note.paperName}</div>
                <p>{note.text}</p>
              </div>
            ))
          )}
        </div>

        {notes.length > 0 && (
          <button
            onClick={handleGenerateReferences}
            style={{
              width: '100%',
              border: '1px solid #d1d5db',
              background: '#2563eb',
              color: '#ffffff',
              padding: '8px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '600',
              marginTop: '12px'
            }}
          >
            Generate References
          </button>
        )}
      </aside>

      {citationPopupVisible && citationPaper && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <div
            ref={citationPopupRef}
            style={{
              background: '#ffffff',
              padding: '24px',
              borderRadius: '12px',
              maxWidth: '500px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Citation for: {citationPaper.title}</h3>

            {(() => {
              const cites = generateCitations(citationPaper);
              return (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>APA</div>
                    <div style={{ fontSize: '0.8rem', background: '#f3f4f6', padding: '8px', borderRadius: '6px', marginBottom: '8px' }}>
                      {cites.apa}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={() => handleCopyCitation(cites.apa)}
                        style={{
                          background: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        Copy
                      </button>
                      {copiedFormat === cites.apa && (
                        <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '600' }}>Copied!</span>
                      )}
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>MLA</div>
                    <div style={{ fontSize: '0.8rem', background: '#f3f4f6', padding: '8px', borderRadius: '6px', marginBottom: '8px' }}>
                      {cites.mla}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={() => handleCopyCitation(cites.mla)}
                        style={{
                          background: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        Copy
                      </button>
                      {copiedFormat === cites.mla && (
                        <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '600' }}>Copied!</span>
                      )}
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>Vancouver</div>
                    <div style={{ fontSize: '0.8rem', background: '#f3f4f6', padding: '8px', borderRadius: '6px', marginBottom: '8px' }}>
                      {cites.vancouver}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={() => handleCopyCitation(cites.vancouver)}
                        style={{
                          background: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        Copy
                      </button>
                      {copiedFormat === cites.vancouver && (
                        <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '600' }}>Copied!</span>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {referencePopupVisible && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <div
            ref={referencePopupRef}
            style={{
              background: '#ffffff',
              padding: '24px',
              borderRadius: '12px',
              maxWidth: '600px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
          >
            {!referenceStyle ? (
              <>
                <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Choose Citation Style</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => handleSelectReferenceStyle('apa')}
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      textAlign: 'left'
                    }}
                  >
                    APA Style
                  </button>
                  <button
                    onClick={() => handleSelectReferenceStyle('mla')}
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      textAlign: 'left'
                    }}
                  >
                    MLA Style
                  </button>
                  <button
                    onClick={() => handleSelectReferenceStyle('vancouver')}
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      textAlign: 'left'
                    }}
                  >
                    Vancouver Style
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0 }}>Reference List</h3>
                  <button
                    onClick={handleCloseReferencePopup}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '1.5rem',
                      color: '#999',
                      cursor: 'pointer'
                    }}
                  >
                    ×
                  </button>
                </div>
                <textarea
                  value={generatedReferences}
                  readOnly
                  style={{
                    width: '100%',
                    height: '300px',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    marginBottom: '12px',
                    resize: 'none'
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={handleCopyReferences}
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      flex: 1
                    }}
                  >
                    Copy All
                  </button>
                  {referenceCopied && (
                    <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '600' }}>Copied!</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
