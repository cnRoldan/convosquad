// Generado desde las migraciones con npm run db:types.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      call_up_players: {
        Row: {
          id: string;
          club_id: string;
          call_up_id: string;
          source_player_id: string | null;
          user_id: string | null;
          ea_id_snapshot: string;
          jersey_number_snapshot: number | null;
          position_snapshot: Database['public']['Enums']['player_position'];
          availability: Database['public']['Enums']['availability_status'];
          responded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          call_up_id: string;
          source_player_id?: string | null;
          user_id?: string | null;
          ea_id_snapshot: string;
          jersey_number_snapshot?: number | null;
          position_snapshot: Database['public']['Enums']['player_position'];
          availability?: Database['public']['Enums']['availability_status'];
          responded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          call_up_id?: string;
          source_player_id?: string | null;
          user_id?: string | null;
          ea_id_snapshot?: string;
          jersey_number_snapshot?: number | null;
          position_snapshot?: Database['public']['Enums']['player_position'];
          availability?: Database['public']['Enums']['availability_status'];
          responded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'call_up_players_club_id_call_up_id_fkey'; columns: ["club_id","call_up_id"]; isOneToOne: false; referencedRelation: 'call_ups'; referencedColumns: ["club_id","id"]; },
          { foreignKeyName: 'call_up_players_club_id_source_player_id_fkey'; columns: ["club_id","source_player_id"]; isOneToOne: false; referencedRelation: 'players'; referencedColumns: ["club_id","id"]; },
          { foreignKeyName: 'call_up_players_user_id_fkey'; columns: ["user_id"]; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ["id"]; },
        ];
      };
      call_ups: {
        Row: {
          id: string;
          club_id: string;
          starts_at: string;
          local_date: string;
          timezone: string;
          status: Database['public']['Enums']['call_up_status'];
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          starts_at: string;
          local_date: string;
          timezone: string;
          status?: Database['public']['Enums']['call_up_status'];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          starts_at?: string;
          local_date?: string;
          timezone?: string;
          status?: Database['public']['Enums']['call_up_status'];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'call_ups_club_id_fkey'; columns: ["club_id"]; isOneToOne: false; referencedRelation: 'clubs'; referencedColumns: ["id"]; },
          { foreignKeyName: 'call_ups_created_by_fkey'; columns: ["created_by"]; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ["id"]; },
        ];
      };
      club_directory: {
        Row: {
          club_id: string;
          name: string;
          description: string | null;
        };
        Insert: {
          club_id: string;
          name: string;
          description?: string | null;
        };
        Update: {
          club_id?: string;
          name?: string;
          description?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'club_directory_club_id_fkey'; columns: ["club_id"]; isOneToOne: true; referencedRelation: 'clubs'; referencedColumns: ["id"]; },
        ];
      };
      club_invitations: {
        Row: {
          id: string;
          club_id: string;
          token_hash: string;
          expires_at: string;
          revoked_at: string | null;
          max_uses: number;
          uses: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          token_hash: string;
          expires_at: string;
          revoked_at?: string | null;
          max_uses?: number;
          uses?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          token_hash?: string;
          expires_at?: string;
          revoked_at?: string | null;
          max_uses?: number;
          uses?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'club_invitations_club_id_fkey'; columns: ["club_id"]; isOneToOne: false; referencedRelation: 'clubs'; referencedColumns: ["id"]; },
          { foreignKeyName: 'club_invitations_created_by_fkey'; columns: ["created_by"]; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ["id"]; },
        ];
      };
      club_members: {
        Row: {
          id: string;
          club_id: string;
          user_id: string;
          role: Database['public']['Enums']['club_role'];
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          user_id: string;
          role?: Database['public']['Enums']['club_role'];
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          user_id?: string;
          role?: Database['public']['Enums']['club_role'];
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'club_members_club_id_fkey'; columns: ["club_id"]; isOneToOne: false; referencedRelation: 'clubs'; referencedColumns: ["id"]; },
          { foreignKeyName: 'club_members_user_id_fkey'; columns: ["user_id"]; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ["id"]; },
        ];
      };
      clubs: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          timezone: string;
          is_public: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          timezone?: string;
          is_public?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          timezone?: string;
          is_public?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'clubs_created_by_fkey'; columns: ["created_by"]; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ["id"]; },
        ];
      };
      join_requests: {
        Row: {
          id: string;
          club_id: string;
          user_id: string;
          status: Database['public']['Enums']['join_request_status'];
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          user_id: string;
          status?: Database['public']['Enums']['join_request_status'];
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          user_id?: string;
          status?: Database['public']['Enums']['join_request_status'];
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'join_requests_club_id_fkey'; columns: ["club_id"]; isOneToOne: false; referencedRelation: 'clubs'; referencedColumns: ["id"]; },
          { foreignKeyName: 'join_requests_decided_by_fkey'; columns: ["decided_by"]; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ["id"]; },
          { foreignKeyName: 'join_requests_user_id_fkey'; columns: ["user_id"]; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ["id"]; },
        ];
      };
      players: {
        Row: {
          id: string;
          club_id: string;
          ea_id: string;
          jersey_number: number | null;
          position: Database['public']['Enums']['player_position'];
          user_id: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          ea_id: string;
          jersey_number?: number | null;
          position: Database['public']['Enums']['player_position'];
          user_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          ea_id?: string;
          jersey_number?: number | null;
          position?: Database['public']['Enums']['player_position'];
          user_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'players_club_id_fkey'; columns: ["club_id"]; isOneToOne: false; referencedRelation: 'clubs'; referencedColumns: ["id"]; },
          { foreignKeyName: 'players_club_id_user_id_fkey'; columns: ["club_id","user_id"]; isOneToOne: true; referencedRelation: 'club_members'; referencedColumns: ["club_id","user_id"]; },
        ];
      };
      profiles: {
        Row: {
          id: string;
          username: string;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: 'profiles_id_fkey'; columns: ["id"]; isOneToOne: true; referencedRelation: 'users'; referencedColumns: ["id"]; },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_call_up: {
        Args: {
          p_club_id: string;
          p_starts_at: string;
          p_status?: Database['public']['Enums']['call_up_status'];
        };
        Returns: Database['public']['Tables']['call_ups']['Row'][];
      };
      create_club: {
        Args: {
          p_name: string;
          p_description?: string;
          p_timezone?: string;
          p_is_public?: boolean;
        };
        Returns: Database['public']['Tables']['clubs']['Row'][];
      };
      create_club_invitation: {
        Args: {
          p_club_id: string;
          p_expires_at: string;
          p_max_uses?: number;
        };
        Returns: { id: string; token: string; expires_at: string }[];
      };
      link_player_account: {
        Args: {
          p_player_id: string;
          p_user_id: string;
        };
        Returns: Database['public']['Tables']['players']['Row'][];
      };
      redeem_club_invitation: {
        Args: {
          p_club_id: string;
          p_token: string;
        };
        Returns: Database['public']['Tables']['club_members']['Row'][];
      };
      request_to_join: {
        Args: {
          p_club_id: string;
        };
        Returns: Database['public']['Tables']['join_requests']['Row'][];
      };
      respond_to_call_up: {
        Args: {
          p_call_up_player_id: string;
          p_availability: Database['public']['Enums']['availability_status'];
        };
        Returns: Database['public']['Tables']['call_up_players']['Row'][];
      };
      review_join_request: {
        Args: {
          p_request_id: string;
          p_approve: boolean;
          p_player_id?: string;
        };
        Returns: Database['public']['Tables']['join_requests']['Row'][];
      };
      revoke_club_invitation: {
        Args: {
          p_invitation_id: string;
        };
        Returns: undefined;
      };
      set_club_member: {
        Args: {
          p_club_id: string;
          p_user_id: string;
          p_role: Database['public']['Enums']['club_role'];
          p_is_active: boolean;
        };
        Returns: Database['public']['Tables']['club_members']['Row'][];
      };
      update_call_up: {
        Args: {
          p_call_up_id: string;
          p_starts_at: string;
          p_status: Database['public']['Enums']['call_up_status'];
        };
        Returns: Database['public']['Tables']['call_ups']['Row'][];
      };
    };
    Enums: {
      availability_status: 'unanswered' | 'available' | 'unavailable' | 'backup';
      call_up_status: 'draft' | 'open' | 'closed' | 'cancelled';
      club_role: 'admin' | 'player';
      join_request_status: 'pending' | 'approved' | 'rejected';
      player_position: 'POR' | 'DFC' | 'LI' | 'LD' | 'MCD' | 'MC' | 'MCO' | 'MI' | 'MD' | 'EI' | 'ED' | 'DC';
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
