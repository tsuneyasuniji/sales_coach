import React, { useState } from 'react';
import { askApi } from '../api/askApi';

interface Participant {
  name: string;
  position: string;
  company: string;
}

interface ActionItem {
  task: string;
  responsible: string;
  deadline: string;
}

interface NextMeeting {
  date: string;
  time: string;
  location: string;
  agenda: string;
}

interface MinutesData {
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  participants: Participant[];
  absentees: string[];
  agendaItems: string[];
  agreements: string[];
  concerns: string[];
  actionItems: ActionItem[];
  nextSteps: string[];
  otherMatters: string;
  nextMeeting: NextMeeting;
  creator: string;
  creationDate: string;
}

const MinutesCreator: React.FC<{ messages: any[] }> = ({ messages }) => {
  const [minutesData, setMinutesData] = useState<MinutesData>({
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    location: '',
    participants: [{ name: '', position: '', company: '' }],
    absentees: [''],
    agendaItems: [''],
    agreements: [''],
    concerns: [''],
    actionItems: [{ task: '', responsible: '', deadline: '' }],
    nextSteps: [''],
    otherMatters: '',
    nextMeeting: {
      date: '',
      time: '',
      location: '',
      agenda: '',
    },
    creator: '',
    creationDate: new Date().toISOString().split('T')[0],
  });

  const handleChange = (section: string, field: string, value: any, index?: number) => {
    setMinutesData(prev => {
      const newData = { ...prev };
      
      if (section === 'participants' && typeof index === 'number') {
        newData.participants[index] = { ...newData.participants[index], [field]: value };
      } else if (section === 'absentees' && typeof index === 'number') {
        newData.absentees[index] = value;
      } else if (section === 'agendaItems' && typeof index === 'number') {
        newData.agendaItems[index] = value;
      } else if (section === 'agreements' && typeof index === 'number') {
        newData.agreements[index] = value;
      } else if (section === 'concerns' && typeof index === 'number') {
        newData.concerns[index] = value;
      } else if (section === 'actionItems' && typeof index === 'number') {
        newData.actionItems[index] = { ...newData.actionItems[index], [field]: value };
      } else if (section === 'nextSteps' && typeof index === 'number') {
        newData.nextSteps[index] = value;
      } else if (section === 'nextMeeting') {
        if (field in newData.nextMeeting) {
          newData.nextMeeting[field as keyof NextMeeting] = value;
        }
      } else {
        (newData as any)[section] = value;
      }
      
      return newData;
    });
  };

  const addItem = (section: string) => {
    setMinutesData(prev => {
      const newData = { ...prev };
      
      if (section === 'participants') {
        newData.participants.push({ name: '', position: '', company: '' });
      } else if (section === 'absentees') {
        newData.absentees.push('');
      } else if (section === 'agendaItems') {
        newData.agendaItems.push('');
      } else if (section === 'agreements') {
        newData.agreements.push('');
      } else if (section === 'concerns') {
        newData.concerns.push('');
      } else if (section === 'actionItems') {
        newData.actionItems.push({ task: '', responsible: '', deadline: '' });
      } else if (section === 'nextSteps') {
        newData.nextSteps.push('');
      }
      
      return newData;
    });
  };

  const removeItem = (section: string, index: number) => {
    setMinutesData(prev => {
      const newData = { ...prev };
      
      if (section === 'participants') {
        newData.participants.splice(index, 1);
      } else if (section === 'absentees') {
        newData.absentees.splice(index, 1);
      } else if (section === 'agendaItems') {
        newData.agendaItems.splice(index, 1);
      } else if (section === 'agreements') {
        newData.agreements.splice(index, 1);
      } else if (section === 'concerns') {
        newData.concerns.splice(index, 1);
      } else if (section === 'actionItems') {
        newData.actionItems.splice(index, 1);
      } else if (section === 'nextSteps') {
        newData.nextSteps.splice(index, 1);
      }
      
      return newData;
    });
  };

  const generateFromMessages = async (section: string) => {
    if (messages.length === 0) {
      alert('会話履歴がありません。会話を行ってから生成してください。');
      return;
    }

    const messagesText = messages
      .map(msg => `${msg.speaker}: ${msg.text}`)
      .join('\n\n');

    let prompt = '';
    
    if (section === 'agreements') {
      prompt = `以下は商談の会話です。この会話から合意された条件や事項を抽出し、「項目: 詳細な説明」の形式で3〜5項目リストアップしてください。\n\n${messagesText}`;
    } else if (section === 'concerns') {
      prompt = `以下は商談の会話です。この会話から未解決の懸念事項や問題点を抽出し、「懸念事項: 詳細と未解決の理由」の形式で2〜3項目リストアップしてください。\n\n${messagesText}`;
    } else if (section === 'actionItems') {
      prompt = `以下は商談の会話です。この会話からアクションアイテムを抽出し、「タスク | 担当者 | 期限」の形式で3〜5項目リストアップしてください。期限は具体的な日付で示してください。\n\n${messagesText}`;
    }

    try {
      const response = await askApi(prompt);
      
      if (response.error) {
        alert(`エラーが発生しました: ${response.error}`);
        return;
      }

      // 生成された内容を適切に処理
      // ...
    } catch (error) {
      console.error("Error generating summary:", error);
      alert("要約の生成中にエラーが発生しました。");
    }
  };

  return (
    <div className="minutes-creator">
      <h1>商談後議事録</h1>
      
      <div className="minutes-form">
        <section>
          <h2>会議の詳細</h2>
          <div className="form-group">
            <label>日付:</label>
            <input
              type="date"
              value={minutesData.date}
              onChange={(e) => handleChange('date', '', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>開始時間:</label>
            <input
              type="time"
              value={minutesData.startTime}
              onChange={(e) => handleChange('startTime', '', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>終了時間:</label>
            <input
              type="time"
              value={minutesData.endTime}
              onChange={(e) => handleChange('endTime', '', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>場所:</label>
            <input
              type="text"
              value={minutesData.location}
              onChange={(e) => handleChange('location', '', e.target.value)}
              placeholder="会議室/オンライン会議リンク"
            />
          </div>
        </section>
        
        <section>
          <h2>参加者</h2>
          {minutesData.participants.map((participant, index) => (
            <div key={`participant-${index}`} className="participant-row">
              <input
                type="text"
                value={participant.name}
                onChange={(e) => handleChange('participants', 'name', e.target.value, index)}
                placeholder="氏名"
              />
              <input
                type="text"
                value={participant.position}
                onChange={(e) => handleChange('participants', 'position', e.target.value, index)}
                placeholder="役職"
              />
              <input
                type="text"
                value={participant.company}
                onChange={(e) => handleChange('participants', 'company', e.target.value, index)}
                placeholder="所属企業"
              />
              {minutesData.participants.length > 1 && (
                <button type="button" onClick={() => removeItem('participants', index)}>削除</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => addItem('participants')}>参加者を追加</button>
        </section>
        
        <section>
          <h2>欠席者</h2>
          {minutesData.absentees.map((absentee, index) => (
            <div key={`absentee-${index}`} className="form-group">
              <input
                type="text"
                value={absentee}
                onChange={(e) => handleChange('absentees', '', e.target.value, index)}
                placeholder="氏名"
              />
              {minutesData.absentees.length > 1 && (
                <button type="button" onClick={() => removeItem('absentees', index)}>削除</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => addItem('absentees')}>欠席者を追加</button>
        </section>
        
        <section>
          <h2>元の議題</h2>
          {minutesData.agendaItems.map((item, index) => (
            <div key={`agenda-${index}`} className="form-group">
              <input
                type="text"
                value={item}
                onChange={(e) => handleChange('agendaItems', '', e.target.value, index)}
                placeholder="議題項目"
              />
              {minutesData.agendaItems.length > 1 && (
                <button type="button" onClick={() => removeItem('agendaItems', index)}>削除</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => addItem('agendaItems')}>議題を追加</button>
        </section>
        
        <section>
          <h2>合意された条件</h2>
          {minutesData.agreements.map((agreement, index) => (
            <div key={`agreement-${index}`} className="form-group">
              <textarea
                value={agreement}
                onChange={(e) => handleChange('agreements', '', e.target.value, index)}
                placeholder="合意事項と詳細な説明"
                rows={3}
              />
              {minutesData.agreements.length > 1 && (
                <button type="button" onClick={() => removeItem('agreements', index)}>削除</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => addItem('agreements')}>合意事項を追加</button>
        </section>
        
        <section>
          <h2>未解決の懸念事項と未解決の問題</h2>
          {minutesData.concerns.map((concern, index) => (
            <div key={`concern-${index}`} className="form-group">
              <textarea
                value={concern}
                onChange={(e) => handleChange('concerns', '', e.target.value, index)}
                placeholder="懸念事項/問題点と未解決の理由"
                rows={3}
              />
              {minutesData.concerns.length > 1 && (
                <button type="button" onClick={() => removeItem('concerns', index)}>削除</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => addItem('concerns')}>懸念事項を追加</button>
        </section>
        
        <section>
          <h2>アクションアイテムと責任</h2>
          {minutesData.actionItems.map((item, index) => (
            <div key={`action-${index}`} className="action-row">
              <input
                type="text"
                value={item.task}
                onChange={(e) => handleChange('actionItems', 'task', e.target.value, index)}
                placeholder="具体的なタスク"
              />
              <input
                type="text"
                value={item.responsible}
                onChange={(e) => handleChange('actionItems', 'responsible', e.target.value, index)}
                placeholder="氏名/チーム"
              />
              <input
                type="date"
                value={item.deadline}
                onChange={(e) => handleChange('actionItems', 'deadline', e.target.value, index)}
              />
              {minutesData.actionItems.length > 1 && (
                <button type="button" onClick={() => removeItem('actionItems', index)}>削除</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => addItem('actionItems')}>アクションアイテムを追加</button>
        </section>
        
        <section>
          <h2>次のステップ</h2>
          {minutesData.nextSteps.map((step, index) => (
            <div key={`step-${index}`} className="form-group">
              <textarea
                value={step}
                onChange={(e) => handleChange('nextSteps', '', e.target.value, index)}
                placeholder="次のステップ、責任者、期限"
                rows={2}
              />
              {minutesData.nextSteps.length > 1 && (
                <button type="button" onClick={() => removeItem('nextSteps', index)}>削除</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => addItem('nextSteps')}>次のステップを追加</button>
        </section>
        
        <section>
          <h2>その他の事項</h2>
          <div className="form-group">
            <textarea
              value={minutesData.otherMatters}
              onChange={(e) => handleChange('otherMatters', '', e.target.value)}
              placeholder="その他の議論や決定事項"
              rows={4}
            />
          </div>
        </section>
        
        <section>
          <h2>次回の会議</h2>
          <div className="form-group">
            <label>日付:</label>
            <input
              type="date"
              value={minutesData.nextMeeting.date}
              onChange={(e) => handleChange('nextMeeting', 'date', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>時間:</label>
            <input
              type="time"
              value={minutesData.nextMeeting.time}
              onChange={(e) => handleChange('nextMeeting', 'time', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>場所:</label>
            <input
              type="text"
              value={minutesData.nextMeeting.location}
              onChange={(e) => handleChange('nextMeeting', 'location', e.target.value)}
              placeholder="会議室/オンライン会議リンク"
            />
          </div>
          <div className="form-group">
            <label>議題 (暫定):</label>
            <input
              type="text"
              value={minutesData.nextMeeting.agenda}
              onChange={(e) => handleChange('nextMeeting', 'agenda', e.target.value)}
              placeholder="議題項目"
            />
          </div>
        </section>
        
        <section>
          <h2>議事録情報</h2>
          <div className="form-group">
            <label>議事録作成者:</label>
            <input
              type="text"
              value={minutesData.creator}
              onChange={(e) => handleChange('creator', '', e.target.value)}
              placeholder="あなたの氏名"
            />
          </div>
          <div className="form-group">
            <label>作成日:</label>
            <input
              type="date"
              value={minutesData.creationDate}
              onChange={(e) => handleChange('creationDate', '', e.target.value)}
            />
          </div>
        </section>
        
        <div className="form-actions">
          <button type="button" className="save-button">保存</button>
          <button type="button" className="export-button">PDFに出力</button>
        </div>
      </div>
    </div>
  );
};

export default MinutesCreator; 