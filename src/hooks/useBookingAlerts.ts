import { useEffect, useRef, useCallback, useState } from "react";

interface BookingForAlert {
  id: string;
  environment_name: string;
  requester_name: string;
  display_time: string;
  description?: string;
  start_time: string;
  status: string;
}

/**
 * Hook que monitora reservas e anuncia por áudio (Text-to-Speech)
 * quando o horário de início é atingido.
 * 
 * - Verifica a cada 30 segundos
 * - Usa SpeechSynthesis do navegador (voz pt-BR)
 * - Toca um som de alerta antes da leitura
 * - Evita repetir anúncios já feitos
 */
export function useBookingAlerts(bookings: BookingForAlert[] | undefined, enabled: boolean) {
  const announcedIds = useRef<Set<string>>(new Set());
  const [lastAnnounced, setLastAnnounced] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Gera um som de alerta (chime) usando Web Audio API
  const playAlertChime = useCallback(() => {
    return new Promise<void>((resolve) => {
      try {
        const ctx = audioCtxRef.current || new AudioContext();
        audioCtxRef.current = ctx;

        // Resumir contexto se estiver suspenso (necessário após interação do usuário)
        if (ctx.state === "suspended") {
          ctx.resume();
        }

        const now = ctx.currentTime;

        // Melodia de 3 notas ascendentes (tipo campainha)
        const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
        const duration = 0.3;

        frequencies.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = "sine";
          osc.frequency.value = freq;
          
          gain.gain.setValueAtTime(0, now + i * duration);
          gain.gain.linearRampToValueAtTime(0.4, now + i * duration + 0.05);
          gain.gain.linearRampToValueAtTime(0, now + (i + 1) * duration);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(now + i * duration);
          osc.stop(now + (i + 1) * duration);
        });

        // Segundo toque (mais grave, tipo gongo)
        const totalDuration = frequencies.length * duration;
        const gong = ctx.createOscillator();
        const gongGain = ctx.createGain();
        gong.type = "sine";
        gong.frequency.value = 261.63; // C4
        gongGain.gain.setValueAtTime(0, now + totalDuration + 0.1);
        gongGain.gain.linearRampToValueAtTime(0.5, now + totalDuration + 0.15);
        gongGain.gain.exponentialRampToValueAtTime(0.001, now + totalDuration + 1.5);
        gong.connect(gongGain);
        gongGain.connect(ctx.destination);
        gong.start(now + totalDuration + 0.1);
        gong.stop(now + totalDuration + 1.6);

        setTimeout(() => resolve(), (totalDuration + 1.6) * 1000);
      } catch (e) {
        console.warn("Erro ao tocar alerta:", e);
        resolve();
      }
    });
  }, []);

  // Anuncia uma reserva por voz
  const announceBooking = useCallback(async (booking: BookingForAlert) => {
    if (!("speechSynthesis" in window)) {
      console.warn("SpeechSynthesis não suportada neste navegador");
      return;
    }

    // Tocar chime primeiro
    await playAlertChime();

    // Pequena pausa antes da fala
    await new Promise(r => setTimeout(r, 500));

    // Cancelar qualquer fala em andamento
    window.speechSynthesis.cancel();

    const text = buildAnnouncementText(booking);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.9; // Um pouco mais lento para clareza
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Tentar encontrar voz pt-BR
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith("pt")) 
      || voices.find(v => v.lang.includes("BR"))
      || voices[0];
    
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    window.speechSynthesis.speak(utterance);

    // Repetir anúncio após 10 segundos
    setTimeout(async () => {
      await playAlertChime();
      await new Promise(r => setTimeout(r, 500));
      const repeatUtterance = new SpeechSynthesisUtterance(text);
      repeatUtterance.lang = "pt-BR";
      repeatUtterance.rate = 0.9;
      repeatUtterance.volume = 1.0;
      if (ptVoice) repeatUtterance.voice = ptVoice;
      window.speechSynthesis.speak(repeatUtterance);
    }, 15000);

  }, [playAlertChime]);

  // Verificação periódica
  useEffect(() => {
    if (!enabled || !bookings?.length) return;

    const checkAndAnnounce = () => {
      const now = new Date();

      bookings.forEach((booking) => {
        if (announcedIds.current.has(booking.id)) return;
        if (booking.status === "cancelled") return;

        const startTime = new Date(booking.start_time);
        const diffMs = startTime.getTime() - now.getTime();
        const diffMinutes = diffMs / (1000 * 60);

        // Anunciar se faltam entre -1 e +2 minutos para o evento
        // (janela de 3 minutos: 2 min antes até 1 min depois)
        if (diffMinutes >= -1 && diffMinutes <= 2) {
          announcedIds.current.add(booking.id);
          setLastAnnounced(booking.environment_name);
          announceBooking(booking);
        }
      });
    };

    // Verificar imediatamente
    checkAndAnnounce();

    // Verificar a cada 30 segundos
    const interval = setInterval(checkAndAnnounce, 30000);

    return () => clearInterval(interval);
  }, [enabled, bookings, announceBooking]);

  // Carregar vozes quando disponíveis
  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Teste manual de áudio
  const testAudio = useCallback(async () => {
    await playAlertChime();
    await new Promise(r => setTimeout(r, 500));
    
    const utterance = new SpeechSynthesisUtterance(
      "Sistema de alertas da agenda ativado. Você receberá anúncios automáticos quando seus eventos estiverem prestes a começar."
    );
    utterance.lang = "pt-BR";
    utterance.rate = 0.9;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith("pt")) || voices[0];
    if (ptVoice) utterance.voice = ptVoice;

    window.speechSynthesis.speak(utterance);
  }, [playAlertChime]);

  return { lastAnnounced, testAudio };
}

function buildAnnouncementText(booking: BookingForAlert): string {
  const startDate = new Date(booking.start_time);
  const day = startDate.getDate();
  const month = startDate.toLocaleDateString("pt-BR", { month: "long" });
  const hours = startDate.getHours().toString().padStart(2, "0");
  const minutes = startDate.getMinutes().toString().padStart(2, "0");

  let text = `Atenção! Alerta de reserva. `;
  text += `O ambiente ${booking.environment_name} tem uma reserva agendada `;
  text += `para hoje, dia ${day} de ${month}, `;
  text += `às ${hours} horas`;
  if (minutes !== "00") {
    text += ` e ${minutes} minutos`;
  }
  text += `. `;
  text += `Reserva feita por ${booking.requester_name}. `;
  
  if (booking.display_time) {
    text += `Horário: ${booking.display_time.replace("às", "até")}. `;
  }

  if (booking.description) {
    text += `Descrição: ${booking.description}. `;
  }

  text += `Repito: reserva do ambiente ${booking.environment_name}, `;
  text += `às ${hours}${minutes !== "00" ? ` e ${minutes}` : ""}, `;
  text += `por ${booking.requester_name}.`;

  return text;
}
