import React from 'react';

export type BubbleSide = 'agent' | 'customer';

interface TranscriptBubbleProps {
  side: BubbleSide;
  text: string;
  caption?: string;
  timestamp?: string;
  agentName?: string;
}

const TranscriptBubble: React.FC<TranscriptBubbleProps> = ({
  side,
  text,
  caption,
  timestamp,
  agentName = 'Layla',
}) => {
  const isAgent = side === 'agent';
  const isRtl = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isAgent ? 'flex-start' : 'flex-end',
        marginBottom: '16px',
        maxWidth: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          marginBottom: '4px',
          flexDirection: isAgent ? 'row' : 'row-reverse',
        }}
      >
        <span style={{ fontSize: '13px' }}>{isAgent ? '🤖' : '🎤'}</span>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: '#6b7280',
          }}
        >
          {isAgent ? `${agentName} (Agent)` : 'User'}
        </span>
      </div>

      <div
        style={{
          maxWidth: '76%',
          minWidth: '120px',
          borderRadius: isAgent ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
          padding: '10px 14px 10px 14px',
          background: isAgent
            ? '#fff7ed'
            : '#ffffff',
          border: isAgent ? '1px solid #fdba74' : '1px solid #e5e7eb',
          boxShadow: isAgent ? '0 2px 10px rgba(249, 115, 22, 0.10)' : '0 2px 8px rgba(15, 23, 42, 0.06)',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '15px',
            lineHeight: 1.65,
            color: '#111827',
            direction: isRtl ? 'rtl' : 'ltr',
            textAlign: isRtl ? 'right' : 'left',
            fontFamily: 'inherit',
            wordBreak: 'break-word',
          }}
        >
          {text}
        </p>

        {caption && caption.trim() && (
          <p
            style={{
              margin: '6px 0 0 0',
              fontSize: '12px',
              lineHeight: 1.5,
              color: '#6b7280',
              direction: 'ltr',
              textAlign: 'left',
              fontStyle: 'italic',
              borderTop: '1px solid #fed7aa',
              paddingTop: '6px',
              wordBreak: 'break-word',
            }}
          >
            {caption}
          </p>
        )}
      </div>

      {timestamp && (
        <span
          style={{
            fontSize: '10px',
            color: '#9ca3af',
            marginTop: '3px',
          }}
        >
          {timestamp}
        </span>
      )}
    </div>
  );
};

export default TranscriptBubble;
