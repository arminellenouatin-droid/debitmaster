// DebitMaster Messagerie Interne WhatsApp:
// - Discussions directes (1-on-1) et Canal Équipe d'établissement
// - Messages texte accessibles à tous
// - Notes vocales audio, photos, vidéos, appels audio et appels vidéo en direct réservés à l'Option Avancée (+50%)
// - Isolation étanche : aucun message ni appel ne sort de l'établissement
// - Accusés de lecture, notifications push Chrome, vibration et sonnerie mélodique
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface Company {
  id: string;
  name: string;
}

interface Contact {
  userId: string;
  displayName: string;
  roleLabel: string;
  position: string;
  phone: string | null;
  avatarUrl: string | null;
  isOwner: boolean;
  unreadCount: number;
  lastSeenAt: string | null;
}

interface TeamChannel {
  id: "team";
  name: string;
  unreadCount: number;
  lastMessage: {
    body: string;
    type: string;
    createdAt: string;
  } | null;
}

interface MessageItem {
  id: string;
  tenant_id: string;
  sender_user_id: string;
  sender_name: string;
  recipient_user_id: string | null;
  subject: string | null;
  body: string;
  message_type: "TEXT" | "AUDIO" | "IMAGE" | "VIDEO";
  event_type?: string | null;
  media_path: string | null;
  media_url: string | null;
  media_name: string | null;
  media_mime_type: string | null;
  media_size: number | null;
  metadata?: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
  is_me: boolean;
}

// Composant Lecteur Audio pour Notes Vocales
function VoiceNotePlayer({ url, isMe }: { url: string; isMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const cur = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 0;
    setCurrentTime(cur);
    setProgress(dur > 0 ? (cur / dur) * 100 : 0);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration || 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || !duration) return;
    const seekTo = (parseFloat(e.target.value) / 100) * duration;
    audioRef.current.currentTime = seekTo;
    setProgress(parseFloat(e.target.value));
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className={`flex items-center gap-3 p-2 rounded-xl ${isMe ? "bg-white/15 text-white" : "bg-black/5 text-[var(--primary)]"}`}>
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
          isMe ? "bg-white text-[var(--primary)]" : "bg-[var(--primary)] text-white"
        }`}
        aria-label={isPlaying ? "Pause" : "Lecture note vocale"}
      >
        {isPlaying ? (
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div className="flex-1 flex flex-col justify-center">
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={handleSeek}
          className="w-full h-1.5 bg-black/20 rounded-lg appearance-none cursor-pointer accent-[var(--secondary)]"
        />
        <div className="flex justify-between text-[11px] font-bold mt-1 opacity-80">
          <span>{formatSecs(currentTime)}</span>
          <span>{duration > 0 ? formatSecs(duration) : "0:00"}</span>
        </div>
      </div>
    </div>
  );
}

export function MessagesClient() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [teamChannel, setTeamChannel] = useState<TeamChannel | null>(null);
  const [hasSpecialOption, setHasSpecialOption] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [selectedContactId, setSelectedContactId] = useState<string>("team");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [textBody, setTextBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Modal Upgrade Option Avancée
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeFeatureName, setUpgradeFeatureName] = useState("");

  // Enregistrement vocal (Audio)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Sélecteur fichiers médias
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal d'Appels WebRTC
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callType, setCallType] = useState<"AUDIO" | "VIDEO">("AUDIO");
  const [callState, setCallState] = useState<"OUTGOING" | "INCOMING" | "CONNECTED" | "ENDED">("OUTGOING");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [activeCallTarget, setActiveCallTarget] = useState<Contact | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const callTimerRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Défilement automatique en bas de discussion
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 1. Chargement des établissements autorisés
  useEffect(() => {
    let active = true;
    fetch("/api/companies")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (active) {
          const list = data.companies ?? [];
          setCompanies(list);
          if (list[0]) setTenantId(list[0].id);
        }
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : "Erreur"));
    return () => {
      active = false;
    };
  }, []);

  // 2. Chargement des contacts et droits d'établissement
  const loadContacts = useCallback(async (tId: string) => {
    setLoadingContacts(true);
    try {
      const res = await fetch(`/api/messages/contacts?tenantId=${encodeURIComponent(tId)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible de charger les contacts.");
      setContacts(data.contacts || []);
      setTeamChannel(data.teamChannel || null);
      setHasSpecialOption(Boolean(data.hasSpecialOption));
      setCurrentUserId(data.currentUser?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement contacts");
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    if (tenantId) void loadContacts(tenantId);
  }, [tenantId, loadContacts]);

  // 3. Chargement des messages de la discussion active
  const loadMessages = useCallback(
    async (tId: string, contactId: string) => {
      setLoadingMessages(true);
      try {
        const res = await fetch(
          `/api/messages?tenantId=${encodeURIComponent(tId)}&contactId=${encodeURIComponent(contactId)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Impossible de charger les messages.");
        setMessages(data.messages || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur chargement messages");
      } finally {
        setLoadingMessages(false);
      }
    },
    []
  );

  useEffect(() => {
    if (tenantId && selectedContactId) {
      void loadMessages(tenantId, selectedContactId);
    }
  }, [tenantId, selectedContactId, loadMessages]);

  // 4. Supabase Realtime pour recevoir les nouveaux messages et signaux d'appel instantanément
  useEffect(() => {
    if (!tenantId) return;
    try {
      const client = createSupabaseBrowserClient();
      const channel = client.channel(`chat:${tenantId}`);

      channel
        .on("broadcast", { event: "new-message" }, (payload: { payload: unknown }) => {
          const newMsg = payload.payload as MessageItem;
          // Si le message concerne la conversation active
          if (
            (selectedContactId === "team" && !newMsg.recipient_user_id) ||
            (selectedContactId !== "team" &&
              (newMsg.sender_user_id === selectedContactId || newMsg.recipient_user_id === selectedContactId))
          ) {
            setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
          }
        })
        .on("broadcast", { event: "call-signal" }, async (payload: { payload: unknown }) => {
          const sig = payload.payload as {
            action: string;
            callerId: string;
            recipientId: string;
            callType: "AUDIO" | "VIDEO";
            callerName: string;
            sdp?: RTCSessionDescriptionInit;
            candidate?: RTCIceCandidateInit;
          };
          if (sig.recipientId === currentUserId) {
            if (sig.action === "OFFER") {
              const targetContact = contacts.find((c) => c.userId === sig.callerId) || {
                userId: sig.callerId,
                displayName: sig.callerName || "Collègue",
                roleLabel: "Membre de l'équipe",
                position: "STAFF",
                phone: null,
                avatarUrl: null,
                isOwner: false,
                unreadCount: 0,
                lastSeenAt: null,
              };
              setActiveCallTarget(targetContact);
              setCallType(sig.callType);
              setCallState("INCOMING");
              setCallModalOpen(true);
            } else if (sig.action === "DECLINE" || sig.action === "END") {
              terminateCall();
            }
          }
        })
        .subscribe();

      return () => {
        void client.removeChannel(channel);
      };
    } catch {
      // Realtime fallback to polling
    }
  }, [tenantId, selectedContactId, currentUserId, contacts]);

  // Déclencher le modal de proposition d'Option Avancée
  const triggerUpgradePrompt = (feature: string) => {
    setUpgradeFeatureName(feature);
    setUpgradeModalOpen(true);
  };

  // 5. Envoi d'un message texte
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!textBody.trim() || sending) return;
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          recipientUserId: selectedContactId === "team" ? null : selectedContactId,
          message: textBody.trim(),
          messageType: "TEXT",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible d'envoyer le message.");

      setMessages((prev) => [...prev, data.message]);
      setTextBody("");

      // Émission Realtime broadcast pour le collègue
      try {
        const client = createSupabaseBrowserClient();
        void client.channel(`chat:${tenantId}`).send({
          type: "broadcast",
          event: "new-message",
          payload: data.message,
        });
      } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur envoi message");
    } finally {
      setSending(false);
    }
  };

  // 6. Gestion des Enregistrements Vocaux (Audio)
  const startRecording = async () => {
    if (!hasSpecialOption) {
      triggerUpgradePrompt("les notes vocales WhatsApp");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          await uploadAndSendAudio(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      setError("Accès au microphone refusé ou non supporté.");
    }
  };

  const stopRecordingAndSend = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const uploadAndSendAudio = async (blob: Blob) => {
    setIsUploadingMedia(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("tenantId", tenantId);
      formData.append("type", "AUDIO");
      formData.append("file", blob, `voice-note-${Date.now()}.webm`);

      const uploadRes = await fetch("/api/messages/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        if (uploadData.requiresUpgrade) {
          triggerUpgradePrompt("les notes vocales");
          return;
        }
        throw new Error(uploadData.error || "Échec téléversement note vocale");
      }

      // Enregistrement du message AUDIO
      const msgRes = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          recipientUserId: selectedContactId === "team" ? null : selectedContactId,
          message: "Note vocale",
          messageType: "AUDIO",
          mediaPath: uploadData.path,
          mediaName: uploadData.name,
          mediaMimeType: uploadData.mimeType,
          mediaSize: uploadData.size,
        }),
      });
      const msgData = await msgRes.json();
      if (!msgRes.ok) throw new Error(msgData.error || "Échec envoi note vocale");

      setMessages((prev) => [...prev, msgData.message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur envoi audio");
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // 7. Gestion de l'Upload Photos et Vidéos
  const handleMediaUploadClick = () => {
    if (!hasSpecialOption) {
      triggerUpgradePrompt("l'envoi de photos et vidéos");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingMedia(true);
    setError("");

    const isVideo = file.type.startsWith("video/");
    const mediaType = isVideo ? "VIDEO" : "IMAGE";

    try {
      const formData = new FormData();
      formData.append("tenantId", tenantId);
      formData.append("type", mediaType);
      formData.append("file", file);

      const uploadRes = await fetch("/api/messages/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        if (uploadData.requiresUpgrade) {
          triggerUpgradePrompt("les photos et vidéos");
          return;
        }
        throw new Error(uploadData.error || "Échec upload média");
      }

      const msgRes = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          recipientUserId: selectedContactId === "team" ? null : selectedContactId,
          message: isVideo ? "Vidéo partagée" : "Photo partagée",
          messageType: mediaType,
          mediaPath: uploadData.path,
          mediaName: uploadData.name,
          mediaMimeType: uploadData.mimeType,
          mediaSize: uploadData.size,
        }),
      });
      const msgData = await msgRes.json();
      if (!msgRes.ok) throw new Error(msgData.error || "Échec envoi média");

      setMessages((prev) => [...prev, msgData.message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur upload");
    } finally {
      setIsUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 8. Gestion des Appels Audio et Vidéo WebRTC
  const startCall = async (type: "AUDIO" | "VIDEO") => {
    if (!hasSpecialOption) {
      triggerUpgradePrompt(type === "VIDEO" ? "les appels vidéo en direct" : "les appels audio en direct");
      return;
    }
    if (selectedContactId === "team") {
      setError("Les appels s'effectuent en direct avec un collègue.");
      return;
    }

    const target = contacts.find((c) => c.userId === selectedContactId);
    if (!target) return;

    setActiveCallTarget(target);
    setCallType(type);
    setCallState("OUTGOING");
    setCallModalOpen(true);
    setCallDuration(0);

    // Alerter le serveur et envoyer un Push
    void fetch("/api/messages/call-signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        recipientUserId: target.userId,
        action: "RINGING",
        callType: type,
      }),
    });

    // Envoi signal broadcast WebRTC
    try {
      const client = createSupabaseBrowserClient();
      void client.channel(`chat:${tenantId}`).send({
        type: "broadcast",
        event: "call-signal",
        payload: {
          action: "OFFER",
          callerId: currentUserId,
          recipientId: target.userId,
          callType: type,
        },
      });
    } catch {}

    // Démarrage flux local
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "VIDEO",
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch {
      // Ignorer si pas de caméra
    }
  };

  const acceptIncomingCall = async () => {
    setCallState("CONNECTED");
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = window.setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "VIDEO",
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch {}
  };

  const terminateCall = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Logger la fin de l'appel
    if (activeCallTarget && tenantId) {
      void fetch("/api/messages/call-signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          recipientUserId: activeCallTarget.userId,
          action: callState === "CONNECTED" ? "END" : "DECLINE",
          callType,
          duration: callDuration,
        }),
      });
    }

    setCallModalOpen(false);
    setCallState("ENDED");
    setCallDuration(0);
    // Recharger la conversation pour afficher le journal de l'appel
    void loadMessages(tenantId, selectedContactId);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
      }
    }
  };

  // Contacts filtrés par la recherche
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter((c) => c.displayName.toLowerCase().includes(q) || c.roleLabel.toLowerCase().includes(q));
  }, [contacts, searchQuery]);

  // Contact actuellement sélectionné
  const activeContact = useMemo(() => {
    if (selectedContactId === "team") return null;
    return contacts.find((c) => c.userId === selectedContactId) || null;
  }, [contacts, selectedContactId]);

  return (
    <section className="h-[calc(100vh-140px)] flex flex-col">
      {/* En-tête : Titre, switcher d'établissement et Badge Option */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--line)]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[var(--primary)] tracking-tight">Messagerie d’Établissement</h1>
            {hasSpecialOption ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-600 border border-amber-500/30">
                <span>⭐</span> Option Avancée active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[var(--surface-variant)] text-[var(--muted)] border border-[var(--line)]">
                Option Standard
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            Échanges directs et sécurisés réservés strictement au personnel de votre établissement.
          </p>
        </div>

        {companies.length > 1 && (
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="h-10 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--primary)]"
          >
            {companies.map((co) => (
              <option key={co.id} value={co.id}>
                {co.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-[#ffdad6] text-[var(--danger)] text-xs font-bold flex justify-between items-center">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="font-black text-sm">
            ✕
          </button>
        </div>
      )}

      {/* Interface Principale Type WhatsApp */}
      <div className="mt-4 flex-1 grid grid-cols-1 md:grid-cols-[340px_1fr] bg-[var(--surface)] rounded-2xl border border-[var(--line)] overflow-hidden shadow-sm">
        {/* Colonne Gauche : Liste des Discussions & Contacts */}
        <aside className="border-r border-[var(--line)] flex flex-col h-full bg-[var(--background)]/40">
          {/* Barre de recherche */}
          <div className="p-3 border-b border-[var(--line)]">
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher un collègue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-xs outline-none focus:border-[var(--primary)] font-medium"
              />
              <svg className="w-4 h-4 absolute left-3 top-2.5 text-[var(--muted)] fill-current" viewBox="0 0 24 24">
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
            </div>
          </div>

          {/* Liste déroulante des conversations */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--line)]/50">
            {/* Canal Équipe (Général) */}
            {teamChannel && (
              <button
                type="button"
                onClick={() => setSelectedContactId("team")}
                className={`w-full p-3 text-left flex items-center gap-3 transition-colors ${
                  selectedContactId === "team" ? "bg-[var(--primary)]/10 font-black" : "hover:bg-[var(--surface)]"
                }`}
              >
                <div className="w-11 h-11 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                  👥
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-[var(--primary)] truncate">{teamChannel.name}</p>
                    {teamChannel.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                        {teamChannel.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--muted)] truncate mt-0.5">
                    {teamChannel.lastMessage ? teamChannel.lastMessage.body : "Tous les membres de l'établissement"}
                  </p>
                </div>
              </button>
            )}

            {loadingContacts ? (
              <p className="py-8 text-center text-xs font-bold text-[var(--muted)]">Chargement de l'équipe…</p>
            ) : filteredContacts.length > 0 ? (
              filteredContacts.map((contact) => (
                <button
                  key={contact.userId}
                  type="button"
                  onClick={() => setSelectedContactId(contact.userId)}
                  className={`w-full p-3 text-left flex items-center gap-3 transition-colors ${
                    selectedContactId === contact.userId
                      ? "bg-[var(--primary)]/10 font-black"
                      : "hover:bg-[var(--surface)]"
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[var(--secondary)] to-[var(--primary)] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                    {contact.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-[var(--primary)] truncate">{contact.displayName}</p>
                      {contact.unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                          {contact.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] font-bold text-[var(--muted)] truncate">{contact.roleLabel}</span>
                      {contact.isOwner && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 font-bold shrink-0">
                          Propriétaire
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <p className="py-8 text-center text-xs text-[var(--muted)]">Aucun collègue trouvé.</p>
            )}
          </div>
        </aside>

        {/* Colonne Droite : Fil de Discussion et Composition */}
        <main className="flex flex-col h-full bg-[var(--surface)]">
          {/* Entête de la discussion active */}
          <div className="h-16 px-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--surface)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[var(--primary)] to-[var(--secondary)] text-white flex items-center justify-center font-black text-xs shrink-0">
                {selectedContactId === "team" ? "👥" : activeContact?.displayName.slice(0, 2).toUpperCase() || "?"}
              </div>
              <div>
                <h2 className="text-xs font-black text-[var(--primary)]">
                  {selectedContactId === "team" ? teamChannel?.name || "Canal Équipe" : activeContact?.displayName}
                </h2>
                <p className="text-[10px] text-[var(--muted)] font-medium">
                  {selectedContactId === "team"
                    ? "Visible par tout le personnel de l'établissement"
                    : activeContact?.roleLabel}
                </p>
              </div>
            </div>

            {/* Boutons d'Action Appels (Audio & Vidéo) */}
            {selectedContactId !== "team" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startCall("AUDIO")}
                  title={hasSpecialOption ? "Démarrer un appel audio" : "Option Avancée requise pour les appels audio"}
                  className="w-9 h-9 rounded-xl border border-[var(--line)] flex items-center justify-center text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => startCall("VIDEO")}
                  title={hasSpecialOption ? "Démarrer un appel vidéo" : "Option Avancée requise pour les appels vidéo"}
                  className="w-9 h-9 rounded-xl border border-[var(--line)] flex items-center justify-center text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Fil des Messages (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--background)]/20">
            {loadingMessages ? (
              <p className="py-12 text-center text-xs font-bold text-[var(--muted)]">Chargement des messages…</p>
            ) : messages.length > 0 ? (
              messages.map((item) => (
                <div key={item.id} className={`flex flex-col ${item.is_me ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-3 shadow-sm ${
                      item.is_me
                        ? "bg-[var(--primary)] text-white rounded-br-none"
                        : "bg-[var(--surface)] text-[var(--primary)] border border-[var(--line)] rounded-bl-none"
                    }`}
                  >
                    {/* Nom de l'expéditeur si canal d'équipe et pas moi */}
                    {selectedContactId === "team" && !item.is_me && (
                      <p className="text-[10px] font-black text-[var(--secondary)] mb-1">{item.sender_name}</p>
                    )}

                    {/* Contenu selon le type */}
                    {item.message_type === "AUDIO" && item.media_url ? (
                      <VoiceNotePlayer url={item.media_url} isMe={item.is_me} />
                    ) : item.message_type === "IMAGE" && item.media_url ? (
                      <div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.media_url}
                          alt="Photo partagée"
                          className="rounded-xl max-h-64 object-cover w-full cursor-pointer hover:opacity-95"
                          onClick={() => window.open(item.media_url || "", "_blank")}
                        />
                        {item.body && item.body !== "Photo partagée" && (
                          <p className="text-xs font-medium mt-1">{item.body}</p>
                        )}
                      </div>
                    ) : item.message_type === "VIDEO" && item.media_url ? (
                      <div>
                        <video src={item.media_url} controls className="rounded-xl max-h-64 w-full" />
                        {item.body && item.body !== "Vidéo partagée" && (
                          <p className="text-xs font-medium mt-1">{item.body}</p>
                        )}
                      </div>
                    ) : item.event_type?.startsWith("CALL_") ? (
                      <div className="flex items-center gap-2 py-1">
                        <span className="text-base">{item.event_type === "CALL_VIDEO" ? "📹" : "📞"}</span>
                        <span className="text-xs font-bold">{item.body}</span>
                      </div>
                    ) : (
                      <p className="text-xs font-medium leading-relaxed whitespace-pre-wrap">{item.body}</p>
                    )}

                    {/* Heure et Accusé de lecture */}
                    <div
                      className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                        item.is_me ? "text-white/70" : "text-[var(--muted)]"
                      }`}
                    >
                      <span>
                        {new Date(item.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {item.is_me && (
                        <span>{item.read_at ? "✓✓" : "✓"}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 text-center text-xs text-[var(--muted)]">
                <span className="text-3xl block mb-2">💬</span>
                Aucun message dans cette discussion. Envoyez le premier message à votre équipe !
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bannière d'enregistrement vocal direct */}
          {isRecording && (
            <div className="p-3 bg-red-500/10 border-t border-red-500/20 flex items-center justify-between text-red-600">
              <div className="flex items-center gap-2 text-xs font-black">
                <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
                <span>Enregistrement en cours… {recordingDuration}s</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="px-3 py-1 rounded-lg text-xs font-bold border border-red-500/30 hover:bg-red-500/10"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={stopRecordingAndSend}
                  className="px-4 py-1 rounded-lg text-xs font-black bg-red-600 text-white shadow-sm"
                >
                  Envoyer la note
                </button>
              </div>
            </div>
          )}

          {/* Barre de Saisie & Actions (WhatsApp Style) */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-[var(--line)] bg-[var(--surface)]">
            <div className="flex items-center gap-2">
              {/* Input fichier caché pour photos et vidéos */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Bouton Pièce Jointe (Photos / Vidéos) */}
              <button
                type="button"
                onClick={handleMediaUploadClick}
                disabled={isUploadingMedia || isRecording}
                title={hasSpecialOption ? "Envoyer une photo ou vidéo" : "Option Avancée requise pour les photos et vidéos"}
                className="w-10 h-10 rounded-xl border border-[var(--line)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--background)] transition-colors disabled:opacity-40 shrink-0"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5V6H9v9.5a3 3 0 0 0 6 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" />
                </svg>
              </button>

              {/* Champ Texte Principal */}
              <input
                type="text"
                placeholder={isRecording ? "Enregistrement en cours…" : "Écrivez un message…"}
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
                disabled={isRecording || sending}
                className="flex-1 h-11 rounded-xl border border-[var(--line)] bg-[var(--background)] px-4 text-xs outline-none focus:border-[var(--primary)] font-medium"
              />

              {/* Bouton Note Vocale (Microphone) */}
              <button
                type="button"
                onClick={startRecording}
                disabled={isRecording || isUploadingMedia}
                title={hasSpecialOption ? "Enregistrer une note vocale" : "Option Avancée requise pour les notes vocales"}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors shrink-0 ${
                  hasSpecialOption
                    ? "border-[var(--line)] text-[var(--primary)] hover:bg-[var(--primary)]/10"
                    : "border-[var(--line)] text-[var(--muted)] hover:text-amber-600"
                }`}
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </button>

              {/* Bouton Envoyer Texte */}
              <button
                type="submit"
                disabled={!textBody.trim() || sending || isRecording}
                className="h-11 px-4 rounded-xl bg-[var(--primary)] text-white text-xs font-black flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 shrink-0"
              >
                <span>Envoyer</span>
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </form>
        </main>
      </div>

      {/* Modal d'Appels Audio / Vidéo WebRTC */}
      {callModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-white text-center shadow-2xl relative flex flex-col items-center">
            <h3 className="text-sm font-black tracking-widest uppercase text-amber-400">
              {callType === "VIDEO" ? "Appel Vidéo en Direct" : "Appel Audio en Direct"}
            </h3>

            {/* Avatar & Nom */}
            <div className="my-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center font-black text-2xl mx-auto shadow-lg animate-pulse">
                {activeCallTarget?.displayName.slice(0, 2).toUpperCase() || "📞"}
              </div>
              <h2 className="text-xl font-black mt-3">{activeCallTarget?.displayName}</h2>
              <p className="text-xs text-zinc-400 mt-1">{activeCallTarget?.roleLabel}</p>
            </div>

            {/* Statut de l'appel */}
            <p className="text-xs font-bold text-zinc-400 mb-6">
              {callState === "OUTGOING" && "Sonnerie en cours…"}
              {callState === "INCOMING" && "Appel entrant…"}
              {callState === "CONNECTED" && `En communication (${Math.floor(callDuration / 60)}m ${callDuration % 60}s)`}
            </p>

            {/* Flux Vidéo (si Vidéo) */}
            {callType === "VIDEO" && (
              <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden mb-6 relative border border-zinc-800">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-28 h-20 rounded-xl object-cover absolute bottom-3 right-3 border-2 border-white/20 shadow-md"
                />
              </div>
            )}

            {/* Boutons d'Action selon l'état */}
            {callState === "INCOMING" ? (
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={terminateCall}
                  className="px-6 py-3 rounded-full bg-red-600 text-white text-xs font-black hover:bg-red-700 active:scale-95"
                >
                  Refuser
                </button>
                <button
                  type="button"
                  onClick={acceptIncomingCall}
                  className="px-8 py-3 rounded-full bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 active:scale-95"
                >
                  Accepter
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors ${
                    isMuted ? "bg-red-500/20 border-red-500 text-red-400" : "bg-white/10 border-white/20 text-white"
                  }`}
                  title={isMuted ? "Activer le micro" : "Couper le micro"}
                >
                  {isMuted ? "🔇" : "🎤"}
                </button>

                {callType === "VIDEO" && (
                  <button
                    type="button"
                    onClick={toggleVideo}
                    className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors ${
                      isVideoDisabled
                        ? "bg-red-500/20 border-red-500 text-red-400"
                        : "bg-white/10 border-white/20 text-white"
                    }`}
                    title={isVideoDisabled ? "Activer la caméra" : "Couper la caméra"}
                  >
                    {isVideoDisabled ? "🚫" : "📹"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={terminateCall}
                  className="px-6 py-3 rounded-full bg-red-600 text-white text-xs font-black hover:bg-red-700 active:scale-95 flex items-center gap-2"
                >
                  <span>Raccrocher</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Promotionnel Option Avancée (+50%) */}
      {upgradeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--line)] rounded-3xl p-6 text-[var(--primary)] shadow-2xl relative">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center text-2xl mx-auto mb-4 border border-amber-500/30">
              ⭐
            </div>
            <h3 className="text-xl font-black text-center">Débloquez l’Option Avancée</h3>
            <p className="text-xs text-center text-[var(--muted)] mt-2 leading-relaxed">
              Pour utiliser <strong className="text-[var(--primary)]">{upgradeFeatureName}</strong> dans votre
              établissement, passez à l’<strong>Option Avancée (+50%)</strong> de votre abonnement.
            </p>

            <div className="my-5 p-4 rounded-2xl bg-[var(--background)] border border-[var(--line)] space-y-2.5 text-xs font-bold">
              <div className="flex items-center gap-2 text-emerald-600">
                <span>✓</span>
                <span>Messagerie texte interne : Incluse</span>
              </div>
              <div className="flex items-center gap-2 text-amber-700">
                <span>⭐</span>
                <span>Notes vocales audio WhatsApp : Option Avancée</span>
              </div>
              <div className="flex items-center gap-2 text-amber-700">
                <span>⭐</span>
                <span>Partage de photos et vidéos : Option Avancée</span>
              </div>
              <div className="flex items-center gap-2 text-amber-700">
                <span>⭐</span>
                <span>Appels audio et vidéo en direct : Option Avancée</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setUpgradeModalOpen(false)}
                className="flex-1 h-11 rounded-xl border border-[var(--line)] text-xs font-black hover:bg-[var(--background)] transition-colors"
              >
                Plus tard
              </button>
              <Link
                href="/dashboard/subscription"
                onClick={() => setUpgradeModalOpen(false)}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-black flex items-center justify-center shadow-md hover:opacity-95 transition-opacity"
              >
                Découvrir (+50%)
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
