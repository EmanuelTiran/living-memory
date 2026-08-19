export function getChatAvatarPresentation({
  voiceInputPhase = 'idle',
  isSending = false,
  speechStatus = 'idle',
  avatarStatus = 'idle',
  realtimeStatus = 'unavailable',
} = {}) {
  if (voiceInputPhase === 'recording') {
    return {
      mode: 'listening',
      label: 'מקשיב לשאלה שלך…',
      detail: 'אפשר לדבר כעת. בסיום לחצו על עצירת ההקלטה.',
    }
  }

  if (voiceInputPhase === 'requesting') {
    return {
      mode: 'listening',
      label: 'פותח את המיקרופון…',
      detail: 'ההקלטה תתחיל מיד כשהדפדפן יחבר את המיקרופון.',
    }
  }

  if (voiceInputPhase === 'transcribing') {
    return {
      mode: 'thinking',
      label: 'מתמלל את השאלה…',
      detail: 'התמלול יופיע בשדה כדי שתוכלו לבדוק אותו לפני השליחה.',
    }
  }

  if (speechStatus === 'loading') {
    if (
      avatarStatus ===
        'realtime-preparing' ||
      realtimeStatus === 'connecting'
    ) {
      return {
        mode: 'realtime-connecting',
        label: 'מחבר את האווטאר החי…',
        detail:
          'הקול האישי מוכן בצד השרת ויתנגן כשהשידור החי יתחיל.',
      }
    }

    return {
      mode: 'preparing-voice',
      label: 'מכין את הקול האישי…',
      detail:
        avatarStatus === 'preparing'
          ? 'הקול יתחיל מיד כשהוא מוכן; D‑ID ממשיך להכין וידאו ברקע.'
          : 'הקול יתחיל מיד כשהוא מוכן.',
    }
  }

  if (speechStatus === 'playing') {
    return {
      mode: 'speaking',
      label: 'מדבר עכשיו',
      detail:
        avatarStatus ===
          'realtime-speaking' ||
        realtimeStatus === 'speaking'
          ? 'הקול והפנים מסונכרנים בשידור חי.'
          : avatarStatus === 'preparing'
          ? 'הקול כבר מתנגן. D‑ID ממשיך להכין וידאו אופציונלי ברקע.'
          : 'התשובה מושמעת בקול האישי המאושר.',
    }
  }

  if (speechStatus === 'ready') {
    return {
      mode: 'voice-ready',
      label: 'הקול מוכן להפעלה',
      detail: 'הדפדפן מנע הפעלה אוטומטית. לחצו על כפתור ההשמעה שבתשובה.',
    }
  }

  if (isSending) {
    return {
      mode: 'thinking',
      label: 'חושב מתוך הזיכרונות…',
      detail: 'התשובה נבנית רק מן המקורות המאושרים.',
    }
  }

  if (avatarStatus === 'preparing') {
    return {
      mode: 'video-preparing',
      label: 'הווידאו נבנה ברקע',
      detail: 'אפשר להמשיך בשיחה. הווידאו אינו מעכב את הקול.',
    }
  }

  if (avatarStatus === 'ready') {
    return {
      mode: 'video-ready',
      label: 'וידאו נוסף מוכן לצפייה',
      detail: 'הוא לא יופעל מעצמו ולא יחזור על התשובה ללא בחירתכם.',
    }
  }

  if (realtimeStatus === 'connecting') {
    return {
      mode: 'realtime-connecting',
      label: 'מחבר את האווטאר החי…',
      detail:
        'אפשר לכתוב או להקליט שאלה בזמן שהחיבור מתכונן.',
    }
  }

  if (realtimeStatus === 'ready') {
    return {
      mode: 'idle',
      label: 'מוכן לשיחה חיה',
      detail:
        'התשובה הבאה תשתמש בקול האישי ובתנועות פנים בזמן אמת.',
    }
  }

  return {
    mode: 'idle',
    label: 'מוכן לשיחה',
    detail: 'אפשר להקליט או לכתוב שאלה חדשה.',
  }
}
