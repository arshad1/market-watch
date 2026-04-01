import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Clock, Activity } from 'lucide-react';

const BriefCard = ({ brief, index }) => {
  const date = new Date(brief.timestamp);
  const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`glass-card animate-in delay-${(index % 3) + 1}`}>
      <div className="card-header">
        <div className="tag tag-asset">
          <Activity size={12} className="mr-1" style={{ marginRight: '6px' }} />
          {brief.asset}
        </div>
        <div className="timestamp">
          <Clock size={14} />
          {formattedDate}
        </div>
      </div>
      
      <div className="prose">
        <ReactMarkdown>{brief.content}</ReactMarkdown>
      </div>
    </div>
  );
};

export default BriefCard;
