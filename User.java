package com.nexusfiber.backend.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;
import java.time.ZonedDateTime;

/**
 * Domain entity representing a system user (Operator or Supervisor).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("users")
public class User {
    @Id
    private Long id;

    private String username;

    @Column("password_hash")
    private String passwordHash;

    private String role;

    private Boolean isActive;

    private ZonedDateTime dateJoined;

    /**
     * Returns the role as a type-safe {@link UserRole} enum.
     */
    public UserRole getUserRole() {
        return UserRole.valueOf(this.role);
    }
}
